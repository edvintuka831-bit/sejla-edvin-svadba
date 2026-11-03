// Automatski test serverskog dijela: upis potvrde, provjera grupe, admin zaštita, izmjena, brisanje.
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import assert from 'node:assert/strict'

const dir = '.netlify/blobs-test'
rmSync(dir, { recursive: true, force: true })
const PORT = 8790
const proc = spawn(process.execPath, ['scripts/dev-api.mjs'], {
  env: { ...process.env, API_PORT: String(PORT), BLOBS_DIR: dir, ADMIN_PASSWORD: 'test-sifra-123' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((r) => proc.stdout.once('data', r))
const base = `http://127.0.0.1:${PORT}`
const call = async (path, { method = 'GET', body, cookie } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-request': '1', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie') }
}

try {
  let r = await call('/api/rsvp', { method: 'POST', body: { name: 'A', attending: true, guests: 2 } })
  assert.equal(r.status, 400, 'odbija nepotpuno ime')
  r = await call('/api/rsvp', { method: 'POST', body: { name: 'Test Gost', guests: 2 } })
  assert.equal(r.status, 400, 'traži izbor dolaska')
  r = await call('/api/rsvp', { method: 'POST', body: { name: 'Test Gost', attending: true, guests: 3, note: 'Vidimo se!' } })
  assert.equal(r.status, 201)
  assert.equal(r.data.group, 'KOD MLADOŽENJE')
  const id = r.data.id
  r = await call('/api/rsvp', { method: 'POST', body: { name: 'Druga Osoba', attending: false, guests: 5 } })
  assert.equal(r.status, 201)

  r = await call('/api/admin/rsvps')
  assert.equal(r.status, 401, 'admin bez prijave je zaključan')
  r = await call('/api/admin/login', { method: 'POST', body: { password: 'pogresno' } })
  assert.equal(r.status, 401)
  r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-sifra-123' } })
  assert.equal(r.status, 200)
  const cookie = r.cookie.split(';')[0]

  r = await call('/api/admin/rsvps', { cookie })
  assert.equal(r.data.rsvps.length, 2)
  const rec = r.data.rsvps.find((x) => x.id === id)
  assert.equal(rec.group, 'KOD MLADOŽENJE')
  assert.equal(rec.guests, 3)
  assert.equal(r.data.rsvps.find((x) => x.id !== id).guests, 0, 'ne dolazi = 0 osoba')

  r = await call(`/api/admin/rsvps/${id}`, { method: 'PUT', cookie, body: { name: 'Test Gost', attending: true, guests: 4, note: '' } })
  assert.equal(r.data.rsvp.guests, 4)
  assert.equal(r.data.rsvp.group, 'KOD MLADOŽENJE')
  r = await call(`/api/admin/rsvps/${id}`, { method: 'DELETE', cookie })
  assert.equal(r.status, 200)
  r = await call('/api/admin/rsvps', { cookie })
  assert.equal(r.data.rsvps.length, 1)
  console.log('✔ Svi API testovi su prošli.')
} finally {
  proc.kill()
  rmSync(dir, { recursive: true, force: true })
}
