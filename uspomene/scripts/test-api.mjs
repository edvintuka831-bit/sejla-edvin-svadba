// Automatski test serverskih funkcija, sigurnosti i pohrane – LOKALNO
// (lokalni Netlify Blobs + lokalni S3 server umjesto Cloudflare R2). Vidi README → Lokalni razvoj.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { AwsClient } from 'aws4fetch'

const root = resolve(import.meta.dirname, '..')
const env = {}
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2]
}
if (!/127\.0\.0\.1|localhost/.test(env.R2_ENDPOINT || '')) throw new Error('test:api radi samo lokalno')
// Test pokreće vlastiti API server s praznom privremenom bazom
const API_PORT = 8790
const API = `http://127.0.0.1:${API_PORT}`
const server = spawn(process.execPath, [resolve(root, 'scripts/dev-api.mjs')], {
  env: { ...process.env, API_PORT: String(API_PORT), BLOBS_DIR: mkdtempSync(resolve(tmpdir(), 'uspomene-blobs-')) },
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((r) => server.stdout.once('data', r))
process.on('exit', () => server.kill())
const FX = resolve(root, 'scripts/fixtures')
const file = (n) => readFileSync(resolve(FX, n))
const s3 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: env.R2_REGION })
const bucketUrl = `${env.R2_ENDPOINT}/${env.R2_BUCKET}`

let passed = 0
const ok = (name) => console.log(`  ✔ ${name}`, ++passed)
let ipCounter = 0
const freshIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`
const IP = freshIp()

async function call(method, path, body, headers = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'x-test-ip': IP, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers }
}
const post = (p, b, h) => call('POST', p, b, h)

const put = (url, bytes, type) => fetch(url, { method: 'PUT', body: bytes, headers: { 'content-type': type } }).then((r) => r.status)

// Lokalno čišćenje (bucket + blobs): test počinje od nule
async function wipe() {
  const list = await (await s3.fetch(`${bucketUrl}?list-type=2&max-keys=1000`)).text()
  for (const key of [...list.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1])) {
    await s3.fetch(`${bucketUrl}/${key}`, { method: 'DELETE' })
  }
}

console.log('Šejla & Edvin · Uspomene · test API-ja i sigurnosti')
await wipe()

// ---------- prijava administratora
async function loginAs(admin, password, ip = IP) {
  const r = await call('POST', '/api/admin/login', { admin, password }, { 'x-test-ip': ip })
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0]
  return { ...r, cookie }
}
{
  const bad = await loginAs('sejla', 'pogresna-sifra-1234')
  assert.equal(bad.status, 401)
  const nobody = await loginAs('gost', 'Lokalna-Sejla-2027')
  assert.equal(nobody.status, 400)
  const wrongPerson = await loginAs('edvin', env.ADMIN_SEJLA_PASSWORD)
  assert.equal(wrongPerson.status, 401)
  ok('pogrešna šifra, nepostojeći račun i tuđa šifra odbijeni')
  const lockIp = freshIp()
  for (let i = 0; i < 5; i++) await loginAs('edvin', `pogresno-${i}-xxxxxxxx`, lockIp)
  const locked = await loginAs('edvin', env.ADMIN_EDVIN_PASSWORD, lockIp)
  assert.equal(locked.status, 429)
  ok('5 pogrešnih pokušaja → zaključavanje i za tačnu šifru')
}
const sejla = await loginAs('sejla', env.ADMIN_SEJLA_PASSWORD)
assert.equal(sejla.status, 200)
assert.match(sejla.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
const edvin = await loginAs('edvin', env.ADMIN_EDVIN_PASSWORD, freshIp())
assert.equal(edvin.status, 200)
const asAdmin = (cookie) => ({ cookie, 'x-admin-request': '1' })
ok('Šejla i Edvin se prijavljuju (HttpOnly, SameSite=Strict kolačić)')
{
  const me = await call('GET', '/api/admin/me', null, { cookie: edvin.cookie })
  assert.equal(me.data.admin.name, 'Edvin')
  const noCsrf = await post('/api/admin/action', { action: 'approve', ids: ['000000000-aaaaaaaaaaaa'] }, { cookie: sejla.cookie })
  assert.equal(noCsrf.status, 403)
  const forged = await call('GET', '/api/admin/stats', null, { cookie: sejla.cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) })
  assert.equal(forged.status, 401)
  const anon = await call('GET', '/api/admin/stats')
  assert.equal(anon.status, 401)
  ok('bez prijave, s lažnim kolačićem ili bez zaštitnog zaglavlja – odbijeno')
}

// ---------- stolovi (mijenjaju se u administraciji)
{
  const def = await call('GET', '/api/config')
  assert.deepEqual(def.data.tables, Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), label: `Stol ${i + 1}` })))
  const bad = await call('PUT', '/api/admin/tables', { tables: [{ id: 'Sto 1!', label: 'x' }] }, asAdmin(sejla.cookie))
  assert.equal(bad.status, 400)
  const tables = [
    { id: '1', label: 'Sto 1' },
    { id: '2', label: 'Sto 2' },
    { id: 'mladenacki', label: 'Mladenački sto' },
  ]
  const r = await call('PUT', '/api/admin/tables', { tables }, asAdmin(sejla.cookie))
  assert.equal(r.status, 200)
  const cfg = await call('GET', '/api/config')
  assert.deepEqual(cfg.data.tables, tables)
  assert.equal(cfg.data.maxVideoMB, 200)
  ok('zadano Stol 1–10; stolovi se mijenjaju u administraciji i odmah vide gostima')
}

// ---------- upload
const P = file('photo3.jpg') // probni "pregled"
const guestFiles = [
  { clientId: 'a', name: 'photo-gps.jpg', type: 'image/jpeg', bytes: file('photo-gps.jpg'), preview: P, thumb: P },
  { clientId: 'b', name: 'photo4.png', type: 'image/png', bytes: file('photo4.png') },
  { clientId: 'c', name: 'video1.mp4', type: 'video/mp4', bytes: file('video1.mp4'), thumb: P },
  { clientId: 'd', name: 'fake.jpg', type: 'image/jpeg', bytes: file('fake.jpg') },
]
const meta = (f) => ({ clientId: f.clientId, name: f.name, type: f.type, size: f.bytes.length, previewSize: f.preview?.length, thumbSize: f.thumb?.length })
{
  assert.equal((await post('/api/upload/init', { files: [meta(guestFiles[0])] })).status, 400)
  ok('bez saglasnosti nema slanja')
  assert.equal((await post('/api/upload/init', { consent: true, files: [{ name: 'x.exe', type: 'application/x-msdownload', size: 10 }] })).status, 415)
  ok('nedozvoljen format odbijen')
  assert.equal((await post('/api/upload/init', { consent: true, files: [{ name: 'v.mp4', type: 'video/mp4', size: 201 * 1024 * 1024 }] })).status, 413)
  ok('video veći od 200 MB odbijen')
  assert.equal((await post('/api/upload/init', { consent: true, website: 'spam', files: [meta(guestFiles[0])] })).status, 400)
  ok('bot (skriveno polje) odbijen')
}
const init = await post('/api/upload/init', { guestName: 'Amra <b>Test</b>', table: '2', consent: true, files: guestFiles.map(meta) })
assert.equal(init.status, 200, JSON.stringify(init.data))
const item = (cid) => init.data.items.find((i) => i.clientId === cid)
const idOf = (cid) => item(cid).id
{
  // link prihvata SAMO najavljenu veličinu i tip
  const a = item('a')
  assert.equal(await put(a.original, Buffer.concat([file('photo-gps.jpg'), Buffer.alloc(10)]), 'image/jpeg'), 403)
  assert.equal(await put(a.original, file('photo-gps.jpg'), 'text/html'), 403)
  ok('potpisani link odbija drugu veličinu i drugi tip datoteke')
}
for (const it of init.data.items) {
  const f = guestFiles.find((g) => g.clientId === it.clientId)
  assert.equal(await put(it.original, f.bytes, f.type), 200)
  if (it.preview) assert.equal(await put(it.preview, f.preview, 'image/jpeg'), 200)
  if (it.thumb) assert.equal(await put(it.thumb, f.thumb, 'image/jpeg'), 200)
}
ok('datoteke poslane direktno u privatni R2 bucket')
{
  assert.notEqual((await fetch(`${bucketUrl}/m/${idOf('a')}/original.jpg`)).status, 200)
  assert.notEqual((await fetch(`${bucketUrl}?list-type=2`)).status, 200)
  ok('bucket je privatan: bez potpisa nema čitanja ni listanja')
}
{
  const bad = await post('/api/upload/complete', { batchId: init.data.batchId, batchKey: 'pogresan', ids: init.data.items.map((i) => i.id) })
  assert.equal(bad.status, 403)
  ok('tuđe slanje se ne može potvrditi')
}
const complete = await post('/api/upload/complete', { batchId: init.data.batchId, batchKey: init.data.batchKey, ids: init.data.items.map((i) => i.id) })
assert.equal(complete.status, 200)
assert.equal(complete.data.results[idOf('a')].ok, true)
assert.equal(complete.data.results[idOf('b')].ok, true)
assert.equal(complete.data.results[idOf('c')].ok, true)
assert.equal(complete.data.results[idOf('d')].ok, false)
assert.equal((await s3.fetch(`${bucketUrl}/m/${idOf('d')}/original.jpg`, { method: 'HEAD' })).status, 404)
ok('lažna slika odbačena i obrisana; ostale čekaju odobrenje')

// ---------- gosti vide samo odobreno
{
  const g = await call('GET', '/api/gallery')
  assert.equal(g.data.items.length, 0)
  assert.deepEqual(g.data.counts, { photos: 0, videos: 0, wishes: 0 })
  ok('prije odobrenja galerija je prazna')
}

// ---------- čestitke
{
  assert.equal((await post('/api/wish', { guestName: 'Lejla', message: 'Sretno vam bilo, puno ljubavi!', consent: true, table: '1' })).status, 200)
  assert.equal((await post('/api/wish', { guestName: 'Spam', message: 'kupi http://spam.example', consent: true })).status, 400)
  ok('čestitka poslana, spam link odbijen')
}

// ---------- administracija
{
  const st = await call('GET', '/api/admin/stats', null, { cookie: sejla.cookie })
  assert.equal(st.data.pending, 3)
  assert.equal(st.data.wishes.pending, 1)
  assert.ok(st.data.usage.bytes > 150_000, String(st.data.usage.bytes))
  const list = await call('GET', '/api/admin/media?status=pending', null, { cookie: sejla.cookie })
  assert.equal(list.data.total, 3)
  const rec = list.data.items.find((r) => r.id === idOf('a'))
  assert.equal(rec.tableLabel, 'Sto 2')
  assert.equal(rec.guestName, 'Amra bTest/b')
  assert.equal(rec.batchKeyHash, undefined)
  const byTable = await call('GET', '/api/admin/media?status=pending&table=2&kind=video', null, { cookie: sejla.cookie })
  assert.equal(byTable.data.total, 1)
  const dl = await call('GET', `/api/admin/download?id=${idOf('a')}`, null, { cookie: sejla.cookie })
  const res = await fetch(dl.data.url)
  assert.match(res.headers.get('content-disposition'), /attachment/)
  assert.equal(Buffer.compare(Buffer.from(await res.arrayBuffer()), file('photo-gps.jpg')), 0)
  const ts = await call('GET', '/api/admin/table-stats', null, { cookie: sejla.cookie })
  assert.equal(ts.data.sent['2'], 3)
  assert.equal(ts.data.approved['2'] || 0, 0)
  ok('admin: statistika, oznaka stola, filteri, pregled po stolovima, preuzimanje identičnog originala')
}
{
  const r = await post('/api/admin/action', { action: 'approve', ids: [idOf('a'), idOf('b'), idOf('c')] }, asAdmin(edvin.cookie))
  assert.ok(Object.values(r.data.results).every((x) => x.ok), JSON.stringify(r.data))
  const g = await call('GET', '/api/gallery')
  assert.equal(g.data.items.length, 3)
  assert.deepEqual(g.data.counts, { photos: 2, videos: 1, wishes: 0 })
  const photo = g.data.items.find((m) => m.id === idOf('a'))
  assert.equal(photo.tableLabel, 'Sto 2')
  // gost dobija PREGLED (bez EXIF), nikad original fotografije
  const pv = Buffer.from(await (await fetch(photo.previewUrl)).arrayBuffer())
  assert.equal(Buffer.compare(pv, P), 0)
  assert.ok(!JSON.stringify(g.data).includes('original.jpg'))
  const video = g.data.items.find((m) => m.kind === 'video')
  const vr = await fetch(video.videoUrl, { headers: { range: 'bytes=0-99' } })
  assert.equal(vr.status, 206)
  const vfull = Buffer.from(await (await fetch(video.videoUrl)).arrayBuffer())
  assert.equal(Buffer.compare(vfull, file('video1.mp4')), 0)
  ok('odobreno (Edvin) vidljivo u galeriji; gost dobija pregled bez originala; video se strimuje (Range)')
}
{
  const r = await post('/api/admin/action', { action: 'reject', ids: [idOf('b')] }, asAdmin(sejla.cookie))
  assert.equal(r.data.results[idOf('b')].ok, true)
  assert.equal((await call('GET', '/api/gallery')).data.items.length, 2)
  const d = await post('/api/admin/action', { action: 'delete', ids: [idOf('b')] }, asAdmin(sejla.cookie))
  assert.equal(d.data.results[idOf('b')].ok, true)
  assert.equal((await s3.fetch(`${bucketUrl}/m/${idOf('b')}/original.png`, { method: 'HEAD' })).status, 404)
  ok('odbijanje uklanja iz galerije; brisanje briše i iz pohrane')
}
{
  const w = await call('GET', '/api/admin/wishes?status=pending', null, { cookie: sejla.cookie })
  assert.equal(w.data.items[0].tableLabel, 'Sto 1')
  await post('/api/admin/action', { action: 'wish-approve', ids: [w.data.items[0].id] }, asAdmin(sejla.cookie))
  const g = await call('GET', '/api/gallery?type=wishes')
  assert.equal(g.data.items.length, 1)
  ok('čestitka odobrena i vidljiva gostima')
}
{
  const ex = await call('GET', '/api/admin/export?scope=all', null, { cookie: sejla.cookie })
  assert.equal(ex.data.total, 2)
  assert.equal(ex.data.wishes.length, 1)
  for (const it of ex.data.items) assert.equal((await fetch(it.url)).status, 200)
  const sys = await call('GET', '/api/admin/system', null, { cookie: sejla.cookie })
  assert.ok(sys.data.checks.every((c) => c.ok), JSON.stringify(sys.data.checks))
  assert.equal(sys.data.cost.estimatedMonthlyUSD, 0)
  ok('izvoz svih originala za arhivu; provjera sistema: sve u redu, trošak 0 $')
}

// ---------- istovremeni rad: 10 slanja odjednom, Šejla i Edvin odobravaju istovremeno
{
  const before = (await call('GET', '/api/admin/stats', null, { cookie: sejla.cookie })).data
  const one = async (i) => {
    const r = await post('/api/upload/init', { consent: true, guestName: `Paralelni ${i}`, files: [{ clientId: 'x', name: `p${i}.png`, type: 'image/png', size: file('photo4.png').length }] }, { 'x-test-ip': freshIp() })
    await put(r.data.items[0].original, file('photo4.png'), 'image/png')
    await post('/api/upload/complete', { batchId: r.data.batchId, batchKey: r.data.batchKey, ids: [r.data.items[0].id] })
    return r.data.items[0].id
  }
  const ids = await Promise.all(Array.from({ length: 10 }, (_, i) => one(i)))
  const st = (await call('GET', '/api/admin/stats', null, { cookie: sejla.cookie })).data
  assert.equal(st.pending, before.pending + 10)
  assert.equal(st.usage.files, before.usage.files + 10)
  const [a, b] = await Promise.all([
    post('/api/admin/action', { action: 'approve', ids: ids.slice(0, 5) }, asAdmin(sejla.cookie)),
    post('/api/admin/action', { action: 'approve', ids: ids.slice(5) }, asAdmin(edvin.cookie)),
  ])
  assert.ok([...Object.values(a.data.results), ...Object.values(b.data.results)].every((x) => x.ok))
  const g = await call('GET', '/api/gallery?kind=image')
  assert.equal(g.data.counts.photos, 1 + 10)
  await post('/api/admin/action', { action: 'delete', ids }, asAdmin(sejla.cookie))
  const after = (await call('GET', '/api/admin/stats', null, { cookie: sejla.cookie })).data
  assert.equal(after.usage.files, before.usage.files)
  ok('10 istovremenih slanja i istovremeno odobravanje (Šejla + Edvin): ništa se ne gubi')
}

// ---------- ograničenja slanja
{
  const ip = freshIp()
  let last
  for (let i = 0; i < 10; i++) last = await post('/api/wish', { guestName: 'Brzi', message: `poruka ${i}`, consent: true }, { 'x-test-ip': ip })
  assert.equal(last.status, 429)
  const many = Array.from({ length: 21 }, (_, i) => ({ name: `${i}.jpg`, type: 'image/jpeg', size: 1000 }))
  assert.equal((await post('/api/upload/init', { consent: true, files: many })).status, 413)
  ok('ograničenje čestitki po uređaju; najviše 20 datoteka po slanju')
}
{
  const logout = await post('/api/admin/logout', {}, { cookie: sejla.cookie })
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  ok('odjava briše kolačić')
}
console.log(`\nSvi testovi prošli (${passed}).`)
server.kill()
