// POST /api/upload/init
// Gost najavi datoteke. Server provjeri tip, veličinu, broj, ograničenja slanja i slobodan
// prostor, upiše zapise ("uploading") i izda potpisane linkove za upload direktno u
// PRIVATNI Cloudflare R2 bucket – link prihvata samo tačnu veličinu i tip datoteke.
import {
  HttpError,
  IMAGE_TYPES,
  PREVIEW_MAX_BYTES,
  THUMB_MAX_BYTES,
  VIDEO_TYPES,
  cleanName,
  cleanText,
  clientHash,
  handle,
  idTime,
  json,
  newId,
  randomKey,
  readJson,
  settings,
  sha256,
} from '../lib/core.mjs'
import { consumeRate, del, getJSON, getTables, getUsage, idsWithStatus, setJSON, setMarker } from '../lib/db.mjs'
import { deleteObjects, presignPut } from '../lib/r2.mjs'

const MB = 1024 * 1024

async function cleanupStale() {
  // Napušteni uploadi (gost zatvorio stranicu) brišu se nakon 6 sati
  const ids = (await idsWithStatus('idx', 'uploading')).filter((id) => idTime(id) < Date.now() - 6 * 3600_000).slice(0, 15)
  for (const id of ids) {
    const rec = await getJSON(`media/${id}`)
    if (rec) await deleteObjects([rec.originalKey, rec.previewKey, rec.thumbKey])
    await del(`media/${id}`)
    await del(`idx/uploading/${id}`)
  }
}

function validateFile(raw, index) {
  const label = `Datoteka ${index + 1}`
  const type = String(raw?.type || '').toLowerCase()
  const size = Number(raw?.size)
  const name = cleanText(raw?.name || `datoteka-${index + 1}`, 200).replace(/[\n/\\]/g, '_') || `datoteka-${index + 1}`
  const isImage = type in IMAGE_TYPES
  const isVideo = type in VIDEO_TYPES
  if (!isImage && !isVideo) {
    throw new HttpError(415, `${label} (${name}): format nije podržan. Dozvoljene su fotografije (JPG, PNG, WEBP, HEIC) i videozapisi (MP4, MOV, WEBM).`)
  }
  if (!Number.isSafeInteger(size) || size <= 0) throw new HttpError(400, `${label} (${name}) je prazna.`)
  const limit = isImage ? settings.maxImageBytes : settings.maxVideoBytes
  if (size > limit) {
    throw new HttpError(413, `${label} (${name}) je prevelika (${(size / MB).toFixed(1)} MB). Najviše ${Math.round(limit / MB)} MB za ${isImage ? 'fotografiju' : 'video'}.`)
  }
  const int = (v, max) => (Number.isInteger(v) && v > 0 && v <= max ? v : null)
  const sizeOf = (v, max) => (Number.isSafeInteger(v) && v > 0 && v <= max ? v : null)
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
    previewSize: isImage ? sizeOf(raw?.previewSize, PREVIEW_MAX_BYTES) : null,
    thumbSize: sizeOf(raw?.thumbSize, THUMB_MAX_BYTES),
  }
}

export default handle(async (req, context) => {
  const body = await readJson(req)
  if (body.website) throw new HttpError(400, 'Zahtjev je odbijen.')
  if (body.consent !== true) throw new HttpError(400, 'Potrebna je Vaša saglasnost za dijeljenje sadržaja.')

  const guestName = cleanName(body.guestName) || 'Gost'
  const tables = await getTables()
  const table = tables.find((t) => t.id === String(body.table || '')) || null

  const files = Array.isArray(body.files) ? body.files : []
  if (!files.length) throw new HttpError(400, 'Niste izabrali nijednu datoteku.')
  if (files.length > settings.maxFilesPerBatch) {
    throw new HttpError(413, `Odjednom možete poslati najviše ${settings.maxFilesPerBatch} datoteka.`)
  }
  const items = files.map(validateFile)
  const totalBytes = items.reduce((s, f) => s + f.size + (f.previewSize || 0) + (f.thumbSize || 0), 0)

  const hash = clientHash(req, context)
  if (!(await consumeRate(hash, 'files-h', items.length, settings.maxFilesPerHour, 3600))) {
    throw new HttpError(429, 'Poslali ste mnogo datoteka u kratkom roku. Pokušajte ponovo za sat vremena.')
  }
  if (!(await consumeRate(hash, 'files-d', items.length, settings.maxFilesPerDay, 86400))) {
    throw new HttpError(429, 'Dostigli ste dnevno ograničenje slanja. Hvala Vam na uspomenama!')
  }
  if (!(await consumeRate(hash, 'bytes-d', Math.ceil(totalBytes / MB), Math.floor(settings.maxBytesPerDay / MB), 86400))) {
    throw new HttpError(429, 'Dostigli ste dnevno ograničenje veličine slanja.')
  }
  if (!(await consumeRate('svi', 'files-global', items.length, settings.maxFilesGlobalPerDay, 86400))) {
    throw new HttpError(429, 'Galerija trenutno prima previše datoteka. Pokušajte malo kasnije.')
  }

  const usage = await getUsage()
  if (usage.bytes + totalBytes > settings.storageLimitBytes) {
    throw new HttpError(507, 'Prostor za pohranu je trenutno popunjen. Molimo javite se mladencima.')
  }

  await cleanupStale().catch((e) => console.warn('cleanup', e?.message))

  const batchId = newId()
  const batchKey = randomKey()
  const now = new Date().toISOString()
  const response = await Promise.all(items.map(async (f) => {
    const id = newId()
    const rec = {
      id,
      kind: f.kind,
      status: 'uploading',
      guestName,
      tableId: table?.id || null,
      tableLabel: table?.label || null,
      originalName: f.name,
      mimeType: f.type,
      size: f.size,
      width: f.width,
      height: f.height,
      duration: f.duration,
      originalKey: `m/${id}/original.${f.ext}`,
      // slika: pregled za galeriju (bez EXIF/GPS); video: naslovna sličica
      previewKey: f.previewSize ? `m/${id}/preview.jpg` : null,
      previewSize: f.previewSize,
      thumbKey: f.thumbSize ? `m/${id}/thumb.jpg` : null,
      thumbSize: f.thumbSize,
      batchId,
      batchKeyHash: sha256(batchKey),
      consentAt: now,
      createdAt: now,
    }
    await Promise.all([setJSON(`media/${id}`, rec), setMarker(`idx/uploading/${id}`)])
    return {
      clientId: f.clientId,
      id,
      original: await presignPut(rec.originalKey, f.type, f.size),
      preview: rec.previewKey ? await presignPut(rec.previewKey, 'image/jpeg', f.previewSize) : null,
      thumb: rec.thumbKey ? await presignPut(rec.thumbKey, 'image/jpeg', f.thumbSize) : null,
    }
  }))

  return json({ batchId, batchKey, items: response })
})

export const config = { path: '/api/upload/init' }
