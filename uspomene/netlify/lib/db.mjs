// Netlify Blobs – mali zapisi (spisak datoteka, statusi, čestitke, stolovi).
// Same fotografije i videi su u Cloudflare R2, ne ovdje.
//
// Ključevi:
//   media/{id}                  zapis o datoteci (izvor istine)
//   idx/{status}/{id}           prazna oznaka za brzo listanje po statusu
//   wish/{id}, widx/{status}/{id}
//   pub/media, pub/wishes       spisak ODOBRENOG za gostinsku galeriju
//   settings/tables             stolovi (mijenjaju se u administraciji)
//   stats/usage                 ukupno zauzeće prostora
//   rate/..., sec/...           ograničenja slanja i zaštita prijave
import { getStore } from '@netlify/blobs'

export const STORE_NAME = 'sejla-edvin-uspomene'
let store
export const db = () => (store ??= getStore({ name: STORE_NAME, consistency: 'strong' }))

export const getJSON = (key) => db().get(key, { type: 'json' })
export const setJSON = (key, value) => db().setJSON(key, value)
export const del = (key) => db().delete(key)

// Siguran zajednički upis: pročitaj → izmijeni → upiši samo ako niko drugi nije upisao u međuvremenu.
export async function mutateJSON(key, fallback, fn, attempts = 12) {
  for (let i = 0; i < attempts; i++) {
    const current = await db().getWithMetadata(key, { type: 'json' })
    const value = current?.data ?? structuredClone(fallback)
    const next = await fn(value)
    if (next === undefined) return value // bez izmjene
    const res = current
      ? await db().setJSON(key, next, { onlyIfMatch: current.etag })
      : await db().setJSON(key, next, { onlyIfNew: true })
    if (res.modified) return next
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 120 * (i + 1)))
  }
  throw new Error(`Upis nije uspio zbog istovremenih izmjena (${key}).`)
}

export async function listKeys(prefix) {
  const keys = []
  for await (const page of db().list({ prefix, paginate: true })) {
    for (const b of page.blobs) keys.push(b.key)
  }
  return keys
}

export const idsWithStatus = async (prefix, status) =>
  (await listKeys(`${prefix}/${status}/`)).map((k) => k.slice(prefix.length + status.length + 2)).sort()

export async function getMany(prefix, ids, parallel = 25) {
  const out = []
  for (let i = 0; i < ids.length; i += parallel) {
    const chunk = await Promise.all(ids.slice(i, i + parallel).map((id) => getJSON(`${prefix}/${id}`)))
    out.push(...chunk.filter(Boolean))
  }
  return out
}

// Promjena statusa: zapis + oznake za listanje
export async function setStatus(kind, record, status) {
  const recPrefix = kind === 'media' ? 'media' : 'wish'
  const idxPrefix = kind === 'media' ? 'idx' : 'widx'
  const old = record.status
  record.status = status
  await setJSON(`${recPrefix}/${record.id}`, record)
  await db().set(`${idxPrefix}/${status}/${record.id}`, '')
  if (old && old !== status) await del(`${idxPrefix}/${old}/${record.id}`)
}

// ------------------------------------------------ ograničenja (fiksni vremenski prozori)
export async function consumeRate(hash, action, units, limit, windowSeconds) {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
  const key = `rate/${action}/${hash}/${bucket}`
  let allowed = false
  await mutateJSON(key, { used: 0 }, (v) => {
    if (v.used + units > limit) {
      allowed = false
      return undefined
    }
    allowed = true
    return { used: v.used + units, expires: (bucket + 1) * windowSeconds * 1000 }
  })
  return allowed
}

export async function addUsage(bytes, files) {
  return mutateJSON('stats/usage', { bytes: 0, files: 0 }, (v) => ({
    bytes: Math.max(0, v.bytes + bytes),
    files: Math.max(0, v.files + files),
  }))
}

export const getUsage = async () => (await getJSON('stats/usage')) || { bytes: 0, files: 0 }

// ------------------------------------------------ stolovi
export async function getTables() {
  return (await getJSON('settings/tables'))?.tables || []
}
