// POST /api/upload/complete
// Server provjerava šta je STVARNO stiglo u R2: postojanje, veličinu i sadržaj
// (magični bajtovi). Tek tada datoteka čeka odobrenje. Sve sumnjivo se briše.
import { HttpError, ID_RE, detectType, handle, json, readJson, settings, sha256, typeMatches } from '../lib/core.mjs'
import { del, getMany, setMarker, setStatus, tableKey, usageKey } from '../lib/db.mjs'
import { deleteObjects, headObject, readHead } from '../lib/r2.mjs'

async function discard(rec) {
  await deleteObjects([rec.originalKey, rec.previewKey, rec.thumbKey])
  await del(`media/${rec.id}`)
  await del(`idx/uploading/${rec.id}`)
}

async function verify(rec) {
  const original = await headObject(rec.originalKey)
  if (!original) return { ok: false, error: 'Datoteka nije stigla na server. Pokušajte ponovo.' }
  const limit = rec.kind === 'image' ? settings.maxImageBytes : settings.maxVideoBytes
  if (original.size !== rec.size || original.size > limit) {
    await discard(rec)
    return { ok: false, error: 'Veličina datoteke ne odgovara. Datoteka je odbačena.' }
  }
  if (!typeMatches(rec.mimeType, detectType(await readHead(rec.originalKey)))) {
    await discard(rec)
    return { ok: false, error: 'Sadržaj datoteke ne odgovara fotografiji ili videozapisu. Datoteka je odbačena.' }
  }
  // Pregled i sličica moraju biti pravi JPEG; inače se ignorišu
  let extraBytes = 0
  for (const [keyField, sizeField] of [['previewKey', 'previewSize'], ['thumbKey', 'thumbSize']]) {
    if (!rec[keyField]) continue
    const head = await headObject(rec[keyField])
    const valid = head && head.size === rec[sizeField] && detectType(await readHead(rec[keyField], 16)) === 'image/jpeg'
    if (valid) extraBytes += head.size
    else {
      if (head) await deleteObjects([rec[keyField]])
      rec[keyField] = null
      rec[sizeField] = null
    }
  }
  rec.storedBytes = original.size + extraBytes
  rec.completedAt = new Date().toISOString()
  await Promise.all([setMarker(usageKey(rec.id, rec.storedBytes)), setMarker(tableKey(rec))])
  await setStatus('media', rec, 'pending')
  return { ok: true }
}

export default handle(async (req) => {
  const body = await readJson(req)
  const batchId = String(body.batchId || '')
  const batchKey = String(body.batchKey || '')
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))].filter((id) => ID_RE.test(id)) : []
  if (!ID_RE.test(batchId) || !batchKey || !ids.length || ids.length > settings.maxFilesPerBatch) {
    throw new HttpError(400, 'Neispravan zahtjev.')
  }
  const records = await getMany('media', ids)
  if (!records.length || records.some((r) => r.batchId !== batchId || r.batchKeyHash !== sha256(batchKey))) {
    throw new HttpError(403, 'Slanje nije pronađeno ili je isteklo.')
  }

  const results = {}
  const queue = [...records]
  const worker = async () => {
    while (queue.length) {
      const rec = queue.shift()
      if (rec.status !== 'uploading') {
        results[rec.id] = { ok: true }
        continue
      }
      try {
        results[rec.id] = await verify(rec)
      } catch (err) {
        console.error('verify', rec.id, err)
        results[rec.id] = { ok: false, error: 'Provjera datoteke nije uspjela. Pokušajte ponovo.' }
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  for (const id of ids) results[id] ??= { ok: false, error: 'Datoteka nije pronađena.' }
  return json({ results })
})

export const config = { path: '/api/upload/complete' }
