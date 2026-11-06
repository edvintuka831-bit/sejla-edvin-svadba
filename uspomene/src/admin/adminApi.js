import { getJson, postJson } from '../lib/api.js'

// Prijava je u HttpOnly kolačiću (JavaScript ga ne može pročitati); svaka izmjena
// nosi i zaštitno zaglavlje protiv lažnih zahtjeva s drugih stranica.
const H = { 'x-admin-request': '1' }

export const adminGet = (path) => getJson(`/api/admin/${path}`)
export const adminPost = (path, body) => postJson(`/api/admin/${path}`, body, H)

export async function adminPut(path, body) {
  const res = await fetch(`/api/admin/${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...H },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Greška (${res.status}).`)
  return data
}

// Radnje idu u dijelovima (serverska funkcija ima vremensko ograničenje)
export async function adminAction(action, ids, onProgress) {
  const results = {}
  const step = 25
  for (let i = 0; i < ids.length; i += step) {
    const res = await adminPost('action', { action, ids: ids.slice(i, i + step) })
    Object.assign(results, res.results)
    onProgress?.(Math.min(ids.length, i + step), ids.length)
  }
  return results
}

export function safeName(s, max = 60) {
  return (
    String(s || '')
      .normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, max) || 'gost'
  )
}
