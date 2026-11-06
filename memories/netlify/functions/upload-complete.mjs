// POST /api/upload/complete
// Nakon uploada server PROVJERAVA šta je stvarno stiglo u privatni bucket:
// postojanje, stvarnu veličinu i stvarni sadržaj (magični bajtovi).
// Tek tada zapis prelazi u "pending" (čeka odobrenje). Sve ostalo se briše.
import {
  HttpError,
  PREVIEW_MAX_BYTES,
  THUMB_MAX_BYTES,
  adminClient,
  detectType,
  handle,
  json,
  readHead,
  readJson,
  settings,
  sha256,
  typeMatches,
} from '../lib/core.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function discard(supabase, row) {
  const paths = [row.original_path, row.preview_path, row.thumb_path].filter(Boolean)
  await supabase.storage.from('uploads').remove(paths)
  await supabase.from('media').delete().eq('id', row.id)
}

async function verifyRow(supabase, row) {
  const { data: objects, error } = await supabase.storage.from('uploads').list(row.id, { limit: 10 })
  if (error) throw error
  const byName = new Map(objects.map((o) => [`${row.id}/${o.name}`, o]))
  const original = byName.get(row.original_path)
  if (!original) return { ok: false, error: 'Datoteka nije stigla na server. Pokušajte ponovo.' }

  const realSize = Number(original.metadata?.size)
  const limit = row.kind === 'image' ? settings.maxImageBytes : settings.maxVideoBytes
  if (!realSize || realSize > limit) {
    await discard(supabase, row)
    return { ok: false, error: 'Datoteka je prevelika ili prazna.' }
  }

  const detected = detectType(await readHead('uploads', row.original_path))
  if (!typeMatches(row.mime_type, detected)) {
    await discard(supabase, row)
    return { ok: false, error: 'Sadržaj datoteke ne odgovara fotografiji ili videozapisu. Datoteka je odbačena.' }
  }

  // Pregled i sličica: moraju biti pravi JPEG razumne veličine, inače se ignorišu
  const checkJpeg = async (path, max) => {
    if (!path) return null
    const obj = byName.get(path)
    const size = Number(obj?.metadata?.size)
    if (!obj || !size || size > max) return 'drop'
    const head = await readHead('uploads', path, 16)
    return detectType(head) === 'image/jpeg' ? null : 'drop'
  }
  const update = {
    status: 'pending',
    size_bytes: realSize,
    completed_at: new Date().toISOString(),
  }
  const dropped = []
  if ((await checkJpeg(row.preview_path, PREVIEW_MAX_BYTES)) === 'drop') {
    update.preview_path = null
    if (row.preview_path) dropped.push(row.preview_path)
  }
  if ((await checkJpeg(row.thumb_path, THUMB_MAX_BYTES)) === 'drop') {
    update.thumb_path = null
    if (row.thumb_path) dropped.push(row.thumb_path)
  }
  if (dropped.length) await supabase.storage.from('uploads').remove(dropped)

  const { error: updateError } = await supabase
    .from('media')
    .update(update)
    .eq('id', row.id)
    .eq('status', 'uploading')
  if (updateError) throw updateError
  return { ok: true }
}

export default handle(async (req) => {
  const body = await readJson(req)
  const batchId = String(body.batchId || '')
  const batchKey = String(body.batchKey || '')
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter((id) => UUID.test(id)) : []
  if (!UUID.test(batchId) || !batchKey || !ids.length || ids.length > settings.maxFilesPerBatch) {
    throw new HttpError(400, 'Neispravan zahtjev.')
  }

  const supabase = adminClient()
  const { data: rows, error } = await supabase
    .from('media')
    .select('id, kind, status, mime_type, original_path, preview_path, thumb_path, batch_key_hash')
    .eq('batch_id', batchId)
    .in('id', ids)
  if (error) throw error
  if (!rows.length || rows.some((r) => r.batch_key_hash !== sha256(batchKey))) {
    throw new HttpError(403, 'Slanje nije pronađeno ili je isteklo.')
  }

  const results = {}
  for (const row of rows) {
    if (row.status !== 'uploading') {
      results[row.id] = { ok: true }
      continue
    }
    try {
      results[row.id] = await verifyRow(supabase, row)
    } catch (err) {
      console.error('verify', row.id, err)
      results[row.id] = { ok: false, error: 'Provjera datoteke nije uspjela. Pokušajte ponovo.' }
    }
  }
  for (const id of ids) results[id] ??= { ok: false, error: 'Datoteka nije pronađena.' }

  return json({ results })
})

export const config = { path: '/api/upload/complete' }
