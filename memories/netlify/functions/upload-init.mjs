// POST /api/upload/init
// Gost najavi datoteke koje šalje. Server provjeri tip, veličinu, broj datoteka,
// ograničenja slanja i slobodan prostor, upiše zapise ("uploading") i izda
// JEDNOKRATNE potpisane linkove za upload u PRIVATNI bucket "uploads".
import {
  IMAGE_TYPES,
  VIDEO_TYPES,
  HttpError,
  adminClient,
  cleanName,
  cleanText,
  clientHash,
  settings,
  consumeRate,
  handle,
  json,
  randomKey,
  readJson,
  sha256,
} from '../lib/core.mjs'

const MB = 1024 * 1024

async function cleanupStale(supabase) {
  // Napušteni uploadi (gost zatvorio stranicu) – brišu se nakon 6 sati.
  const { data } = await supabase
    .from('media')
    .select('id, original_path, preview_path, thumb_path')
    .eq('status', 'uploading')
    .lt('created_at', new Date(Date.now() - 6 * 3600_000).toISOString())
    .limit(25)
  if (!data?.length) return
  const paths = data.flatMap((m) => [m.original_path, m.preview_path, m.thumb_path]).filter(Boolean)
  await supabase.storage.from('uploads').remove(paths)
  await supabase.from('media').delete().in('id', data.map((m) => m.id))
}

function validateFile(raw, index) {
  const label = `Datoteka ${index + 1}`
  const type = String(raw?.type || '').toLowerCase()
  const size = Number(raw?.size)
  const name = cleanText(raw?.name || `datoteka-${index + 1}`, 200) || `datoteka-${index + 1}`
  const isImage = type in IMAGE_TYPES
  const isVideo = type in VIDEO_TYPES
  if (!isImage && !isVideo) {
    throw new HttpError(415, `${label} (${name}): format nije podržan. Dozvoljene su fotografije (JPG, PNG, WEBP, HEIC) i videozapisi (MP4, MOV, WEBM).`)
  }
  if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, `${label} (${name}) je prazna.`)
  const limit = isImage ? settings.maxImageBytes : settings.maxVideoBytes
  if (size > limit) {
    throw new HttpError(413, `${label} (${name}) je prevelika (${(size / MB).toFixed(1)} MB). Najveća dozvoljena veličina: ${Math.round(limit / MB)} MB za ${isImage ? 'fotografiju' : 'video'}.`)
  }
  const int = (v, max) => (Number.isInteger(v) && v > 0 && v <= max ? v : null)
  const duration = Number(raw?.duration)
  return {
    clientId: String(raw?.clientId || index).slice(0, 64),
    kind: isImage ? 'image' : 'video',
    type,
    ext: isImage ? IMAGE_TYPES[type] : VIDEO_TYPES[type],
    size,
    name,
    width: int(raw?.width, 100_000),
    height: int(raw?.height, 100_000),
    duration: Number.isFinite(duration) && duration > 0 && duration < 36_000 ? Math.round(duration * 100) / 100 : null,
    hasPreview: raw?.hasPreview === true,
    hasThumb: raw?.hasThumb === true,
  }
}

export default handle(async (req, context) => {
  const body = await readJson(req, 40_000)

  // Skriveno polje – popunjavaju ga samo botovi
  if (body.website) throw new HttpError(400, 'Zahtjev je odbijen.')
  if (body.consent !== true) {
    throw new HttpError(400, 'Potrebna je Vaša saglasnost za dijeljenje sadržaja.')
  }
  const guestName = cleanName(body.guestName) || 'Gost'
  const caption = cleanText(body.caption, 300) || null

  const files = Array.isArray(body.files) ? body.files : []
  if (!files.length) throw new HttpError(400, 'Niste izabrali nijednu datoteku.')
  if (files.length > settings.maxFilesPerBatch) {
    throw new HttpError(413, `Odjednom možete poslati najviše ${settings.maxFilesPerBatch} datoteka. Pošaljite ostatak u sljedećem koraku.`)
  }
  const items = files.map(validateFile)
  const totalBytes = items.reduce((s, f) => s + f.size, 0)

  const supabase = adminClient()
  const hash = clientHash(req, context)

  // Ograničenja slanja (po uređaju/mreži i ukupno)
  if (!(await consumeRate(hash, 'files-hour', items.length, settings.maxFilesPerHour, '1 hour'))) {
    throw new HttpError(429, 'Poslali ste mnogo datoteka u kratkom roku. Pokušajte ponovo za sat vremena.')
  }
  if (!(await consumeRate(hash, 'files-day', items.length, settings.maxFilesPerDay, '1 day'))) {
    throw new HttpError(429, 'Dostigli ste dnevno ograničenje slanja. Hvala Vam na uspomenama!')
  }
  if (!(await consumeRate('global', 'files-global', items.length, settings.maxFilesGlobalPerDay, '1 day'))) {
    throw new HttpError(429, 'Galerija trenutno prima previše datoteka. Pokušajte malo kasnije.')
  }

  // Slobodan prostor
  const { data: usedBytes, error: usageError } = await supabase.rpc('storage_usage_bytes')
  if (usageError) throw usageError
  if (Number(usedBytes) + totalBytes * 1.15 > settings.storageLimitBytes) {
    throw new HttpError(507, 'Prostor za pohranu je trenutno popunjen. Molimo javite se mladencima.')
  }

  await cleanupStale(supabase).catch((e) => console.warn('cleanup', e?.message))

  const batchId = crypto.randomUUID()
  const batchKey = randomKey()
  const now = new Date().toISOString()

  const rows = items.map((f) => {
    const id = crypto.randomUUID()
    const imagePreview = f.kind === 'image' && f.hasPreview
    return {
      id,
      kind: f.kind,
      status: 'uploading',
      guest_name: guestName,
      caption,
      original_name: f.name,
      mime_type: f.type,
      size_bytes: f.size,
      width: f.width,
      height: f.height,
      duration_seconds: f.duration,
      original_path: `${id}/original.${f.ext}`,
      // kod slike: pregled za galeriju; kod videa: naslovna sličica (poster)
      preview_path: imagePreview ? `${id}/preview.jpg` : null,
      thumb_path: f.hasThumb ? `${id}/thumb.jpg` : null,
      batch_id: batchId,
      batch_key_hash: sha256(batchKey),
      consent_at: now,
    }
  })

  const { error: insertError } = await supabase.from('media').insert(rows)
  if (insertError) throw insertError

  const bucket = supabase.storage.from('uploads')
  const sign = async (path) => {
    if (!path) return null
    const { data, error } = await bucket.createSignedUploadUrl(path)
    if (error) throw error
    return { path, token: data.token }
  }

  const response = await Promise.all(
    rows.map(async (row, i) => ({
      clientId: items[i].clientId,
      id: row.id,
      original: await sign(row.original_path),
      preview: await sign(row.preview_path),
      thumb: await sign(row.thumb_path),
    })),
  )

  return json({ batchId, batchKey, items: response })
})

export const config = { path: '/api/upload/init' }
