// Netlify Blobs – mali zapisi (spisak datoteka, statusi, čestitke, stolovi).
// Same fotografije i videi su u Cloudflare R2, ne ovdje.
//
// Nema zajedničkih brojača ni zajedničkih spiskova koji se prepisuju: svaka promjena
// je zaseban ključ, pa istovremena slanja i dva administratora ne mogu pregaziti
// jedno drugo. Brojevi i spiskovi se dobijaju listanjem ključeva.
//
//   media/{id}                     zapis o datoteci (izvor istine)
//   idx/{status}/{id}              oznaka za listanje po statusu (admin)
//   gal/{all|image|video}/{rev}-{id}  ODOBRENO za galeriju (rev = najnovije prvo)
//   wish/{id}, widx/{status}/{id}, galw/{rev}-{id}
//   sz/{id}/{bajtova}              zauzeće prostora po datoteci
//   rate/{radnja}/{gost}/{prozor}/{vrijeme}{nasumično}~{količina}   ograničenja slanja
//   sec/login/{admin}/{gost}/{prozor}/{nasumično}          pogrešne prijave
//   settings/tables                stolovi (mijenjaju se u administraciji; zadano Stol 1–10)
//   tbl/{stol}/{id}, tapp/{stol}/{id}   poslano / odobreno po stolu (pregled po stolovima)
import { randomBytes } from 'node:crypto'
import { getStore } from '@netlify/blobs'

export const STORE_NAME = 'sejla-edvin-uspomene'
let store
export const db = () => (store ??= getStore({ name: STORE_NAME, consistency: 'strong' }))

export const getJSON = (key) => db().get(key, { type: 'json' })
export const setJSON = (key, value) => db().setJSON(key, value)
export const setMarker = (key) => db().set(key, '')
export const del = (key) => db().delete(key)
const rnd = () => randomBytes(6).toString('base64url')

export async function listKeys(prefix) {
  const keys = []
  for await (const page of db().list({ prefix, paginate: true })) {
    for (const b of page.blobs) keys.push(b.key)
  }
  return keys.sort()
}

const tail = (prefix) => (k) => k.slice(prefix.length)
export const idsWithStatus = async (base, status) => (await listKeys(`${base}/${status}/`)).map(tail(`${base}/${status}/`))

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
  await setMarker(`${idxPrefix}/${status}/${record.id}`)
  if (old && old !== status) await del(`${idxPrefix}/${old}/${record.id}`)
}

// ------------------------------------------------ galerija (samo odobreno)
// "rev" je obrnuto vrijeme odobrenja → abecedni redoslijed = najnovije prvo
export const revTime = (ms = Date.now()) => String(10 ** 13 - ms).padStart(13, '0')
export const galleryKeys = (rec) => (rec.galRev ? [`gal/all/${rec.galRev}-${rec.id}`, `gal/${rec.kind}/${rec.galRev}-${rec.id}`] : [])
export const tableKey = (rec) => `tbl/${rec.tableId || '-'}/${rec.id}`
export const tableApprovedKey = (rec) => `tapp/${rec.tableId || '-'}/${rec.id}`
export const galleryIds = async (sub) => (await listKeys(`${sub}/`)).map((k) => k.slice(k.indexOf('-', sub.length + 1) + 1))

// ------------------------------------------------ zauzeće prostora
export const usageKey = (id, bytes) => `sz/${id}/${bytes}`
export async function getUsage() {
  const keys = await listKeys('sz/')
  return { files: keys.length, bytes: keys.reduce((s, k) => s + (Number(k.split('/')[2]) || 0), 0) }
}

// ------------------------------------------------ ograničenja (fiksni vremenski prozori)
// Prvo upiši zahtjev, pa prebroji po redoslijedu dolaska: i potpuno istovremeni
// zahtjevi ne mogu zajedno preći ograničenje (višak se poništava).
export async function consumeRate(hash, action, units, limit, windowSeconds) {
  const prefix = `rate/${action}/${hash}/${Math.floor(Date.now() / 1000 / windowSeconds)}/`
  const mine = `${prefix}${Date.now().toString(36).padStart(9, '0')}${rnd()}~${units}`
  await setMarker(mine)
  let used = 0
  for (const k of await listKeys(prefix)) {
    used += Number.parseInt(k.split('~')[1], 10) || 0
    if (k === mine) break
  }
  if (used > limit) {
    await del(mine)
    return false
  }
  return true
}

export async function countEvents(prefix) {
  return (await listKeys(prefix)).length
}
export const addEvent = (prefix) => setMarker(`${prefix}${rnd()}`)
export async function clearEvents(prefix) {
  await Promise.all((await listKeys(prefix)).map(del))
}

// ------------------------------------------------ stolovi
// Dogovoreno: 10 stolova. Dok administratori ne spreme vlastiti spisak, važe ovi.
export const DEFAULT_TABLES = Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), label: `Stol ${i + 1}` }))

export async function getTables() {
  return (await getJSON('settings/tables'))?.tables || DEFAULT_TABLES
}
