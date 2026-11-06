// Automatski test serverskih funkcija, RLS-a i Storagea na LOKALNOM Supabaseu.
//   npx supabase start && npx supabase db reset
//   npm run dev:api        (drugi terminal)
//   npm run test:api
// Test pravi probne administratore i probne datoteke, zato radi samo lokalno.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const root = resolve(import.meta.dirname, '..')
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) process.env[m[1]] ??= m[2]
}
const URL_ = process.env.VITE_SUPABASE_URL
const PUB = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY
const API = process.env.API_BASE || 'http://127.0.0.1:8788'
const FX = process.env.FIXTURES || resolve(root, 'scripts/fixtures')
if (!/127\.0\.0\.1|localhost/.test(URL_)) throw new Error('test:api radi samo na lokalnom Supabaseu')

const service = createClient(URL_, SECRET, { auth: { persistSession: false } })
const anon = createClient(URL_, PUB, { auth: { persistSession: false } })
let passed = 0
const ok = (name) => console.log(`  ✔ ${name}`, ++passed)

async function api(path, body, headers = {}) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-ip': '10.0.0.1', ...headers },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

async function putSigned(target, bytes, type) {
  const res = await fetch(`${URL_}/storage/v1/object/upload/sign/uploads/${target.path}?token=${target.token}`, {
    method: 'PUT',
    headers: { apikey: PUB, authorization: `Bearer ${PUB}`, 'content-type': type, 'x-upsert': 'false', 'cache-control': 'max-age=31536000' },
    body: bytes,
  })
  return res.status
}

const file = (name) => readFileSync(resolve(FX, name))

async function ensureAdmin(email, password) {
  const { data: list } = await service.auth.admin.listUsers()
  let user = list.users.find((u) => u.email === email)
  if (!user) {
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    user = data.user
  }
  const { data: existing } = await service.from('admins').select('user_id').eq('user_id', user.id)
  if (!existing.length) {
    const { error } = await service.from('admins').insert({ user_id: user.id, email })
    if (error) throw error
  }
  return user
}

console.log('Šejla & Edvin · test API-ja')
await service.from('rate_events').delete().gte('id', 0)
// lokalna baza se čisti prije testa
{
  const { data: old } = await service.from('media').select('id')
  for (const { id } of old) {
    for (const b of ['uploads', 'gallery']) {
      const { data: objs } = await service.storage.from(b).list(id)
      if (objs?.length) await service.storage.from(b).remove(objs.map((o) => `${id}/${o.name}`))
    }
  }
  await service.from('media').delete().not('id', 'is', null)
  await service.from('wishes').delete().not('id', 'is', null)
}

// ---------- Administratori
const PASS = 'Probna-Sifra-2027!'
await ensureAdmin('admin1@test.local', PASS)
await ensureAdmin('admin2@test.local', PASS)
{
  const { data } = await service.auth.admin.listUsers()
  let third = data.users.find((u) => u.email === 'gost@test.local')
  if (!third) third = (await service.auth.admin.createUser({ email: 'gost@test.local', password: PASS, email_confirm: true })).data.user
  const { error } = await service.from('admins').insert({ user_id: third.id, email: 'gost@test.local' })
  assert.ok(error && /dva/.test(error.message), 'treći admin mora biti odbijen')
  ok('najviše dva administratorska računa')
}

// ---------- Upload
const guestFiles = [
  { clientId: 'a', name: 'photo1.jpg', type: 'image/jpeg', bytes: file('photo1.jpg'), hasPreview: true, hasThumb: true },
  { clientId: 'b', name: 'photo4.png', type: 'image/png', bytes: file('photo4.png') },
  { clientId: 'c', name: 'video1.mp4', type: 'video/mp4', bytes: file('video1.mp4'), hasThumb: true },
  { clientId: 'd', name: 'fake.jpg', type: 'image/jpeg', bytes: file('fake.jpg') },
]
{
  const r = await api('/api/upload/init', { guestName: 'Test', files: [{ name: 'x.jpg', type: 'image/jpeg', size: 10 }] })
  assert.equal(r.status, 400)
  ok('bez saglasnosti nema slanja')
  const r2 = await api('/api/upload/init', { consent: true, files: [{ name: 'x.exe', type: 'application/x-msdownload', size: 10 }] })
  assert.equal(r2.status, 415)
  ok('nedozvoljen format odbijen')
  const r3 = await api('/api/upload/init', { consent: true, files: [{ name: 'v.mp4', type: 'video/mp4', size: 80 * 1024 * 1024 }] })
  assert.equal(r3.status, 413)
  ok('prevelik video odbijen')
  const r4 = await api('/api/upload/init', { consent: true, website: 'spam', files: [{ name: 'a.jpg', type: 'image/jpeg', size: 10 }] })
  assert.equal(r4.status, 400)
  ok('bot (skriveno polje) odbijen')
}

const init = await api('/api/upload/init', {
  guestName: 'Amra <b>Test</b>',
  consent: true,
  files: guestFiles.map(({ bytes, ...f }) => ({ ...f, size: bytes.length })),
})
assert.equal(init.status, 200, JSON.stringify(init.data))
ok('upload/init izdaje potpisane linkove')
const thumbJpeg = file('photo3.jpg')
for (const item of init.data.items) {
  const f = guestFiles.find((g) => g.clientId === item.clientId)
  assert.equal(await putSigned(item.original, f.bytes, f.type), 200)
  if (item.preview) assert.equal(await putSigned(item.preview, thumbJpeg, 'image/jpeg'), 200)
  if (item.thumb) assert.equal(await putSigned(item.thumb, thumbJpeg, 'image/jpeg'), 200)
}
ok('datoteke poslane direktno u privatni bucket')
{
  // potpisani link je jednokratan – ponovni upload na istu putanju ne prolazi
  const first = init.data.items[0]
  assert.notEqual(await putSigned(first.original, file('photo2.jpg'), 'image/jpeg'), 200)
  ok('potpisani link se ne može ponovo iskoristiti')
}
{
  const bad = await api('/api/upload/complete', { batchId: init.data.batchId, batchKey: 'pogresan', ids: init.data.items.map((i) => i.id) })
  assert.equal(bad.status, 403)
  ok('tuđe slanje se ne može potvrditi')
}
const complete = await api('/api/upload/complete', {
  batchId: init.data.batchId,
  batchKey: init.data.batchKey,
  ids: init.data.items.map((i) => i.id),
})
assert.equal(complete.status, 200)
const idOf = (cid) => init.data.items.find((i) => i.clientId === cid).id
assert.equal(complete.data.results[idOf('a')].ok, true)
assert.equal(complete.data.results[idOf('b')].ok, true)
assert.equal(complete.data.results[idOf('c')].ok, true)
assert.equal(complete.data.results[idOf('d')].ok, false)
ok('lažna slika (pogrešan sadržaj) odbačena, ostale čekaju odobrenje')
{
  const { data } = await service.from('media').select('id').eq('id', idOf('d'))
  assert.equal(data.length, 0)
  const { data: objs } = await service.storage.from('uploads').list(idOf('d'))
  assert.equal(objs.length, 0)
  const { data: row } = await service.from('media').select('guest_name,status').eq('id', idOf('a')).single()
  assert.equal(row.guest_name, 'Amra bTest/b')
  assert.equal(row.status, 'pending')
  ok('odbačena datoteka obrisana iz baze i storagea; ime očišćeno')
}

// ---------- Gosti ne vide ništa neodobreno
{
  const g = await anon.rpc('gallery_media', {})
  assert.equal(g.error, null)
  assert.equal(g.data.length, 0)
  const t = await anon.from('media').select('*')
  assert.ok(t.error || t.data.length === 0)
  const w = await anon.from('wishes').select('*')
  assert.ok(w.error || w.data.length === 0)
  const r = await anon.rpc('consume_rate', { p_client_hash: 'x', p_action: 'y', p_units: 1, p_limit: 1, p_window: '1 hour' })
  assert.ok(r.error)
  const s = await anon.rpc('admin_stats')
  assert.ok(s.error)
  const d = await anon.storage.from('uploads').download(`${idOf('a')}/original.jpg`)
  assert.ok(d.error)
  const l = await anon.storage.from('uploads').list(idOf('a'))
  assert.equal((l.data || []).length, 0)
  const pub = await fetch(`${URL_}/storage/v1/object/public/uploads/${idOf('a')}/original.jpg`)
  assert.notEqual(pub.status, 200)
  const ins = await anon.from('media').insert({ kind: 'image' })
  assert.ok(ins.error)
  const up = await anon.storage.from('uploads').upload('hack/x.jpg', file('photo3.jpg'), { contentType: 'image/jpeg' })
  assert.ok(up.error)
  const up2 = await anon.storage.from('gallery').upload('hack/x.jpg', file('photo3.jpg'), { contentType: 'image/jpeg' })
  assert.ok(up2.error)
  ok('gost: nema pristupa tabelama, privatnim datotekama, uploadu mimo servera ni admin funkcijama')
}

// ---------- Čestitke
{
  const w = await api('/api/wish', { guestName: 'Lejla', message: 'Sretno vam bilo, puno ljubavi!', consent: true })
  assert.equal(w.status, 200)
  const link = await api('/api/wish', { guestName: 'Spam', message: 'kupi http://spam.example', consent: true })
  assert.equal(link.status, 400)
  ok('čestitka poslana, spam link odbijen')
}

// ---------- Admin
const notAdmin = createClient(URL_, PUB, { auth: { persistSession: false } })
await notAdmin.auth.signInWithPassword({ email: 'gost@test.local', password: PASS })
{
  const { data } = await notAdmin.from('media').select('*')
  assert.equal(data.length, 0)
  const token = (await notAdmin.auth.getSession()).data.session.access_token
  const r = await api('/api/admin', { action: 'approve', ids: [idOf('a')] }, { authorization: `Bearer ${token}` })
  assert.equal(r.status, 403)
  const r2 = await api('/api/admin', { action: 'approve', ids: [idOf('a')] })
  assert.equal(r2.status, 401)
  ok('prijavljeni korisnik koji nije admin nema pristup')
}

const admin = createClient(URL_, PUB, { auth: { persistSession: false } })
{
  const { error } = await admin.auth.signInWithPassword({ email: 'admin1@test.local', password: PASS })
  assert.equal(error, null)
  const { data: isAdmin } = await admin.rpc('is_admin')
  assert.equal(isAdmin, true)
  const { data: pending } = await admin.from('media').select('*').eq('status', 'pending')
  assert.equal(pending.length, 3)
  const { data: stats } = await admin.rpc('admin_stats')
  assert.equal(Number(stats[0].pending_photos), 2)
  assert.equal(Number(stats[0].pending_videos), 1)
  const { data: signed } = await admin.storage.from('uploads').createSignedUrl(`${idOf('a')}/original.jpg`, 60)
  const res = await fetch(signed.signedUrl)
  assert.equal(Buffer.compare(Buffer.from(await res.arrayBuffer()), file('photo1.jpg')), 0)
  ok('admin vidi stavke na čekanju, statistiku i preuzima identičan original')
}
const token = (await admin.auth.getSession()).data.session.access_token
const adm = (action, ids) => api('/api/admin', { action, ids }, { authorization: `Bearer ${token}` })
{
  const r = await adm('approve', [idOf('a'), idOf('b'), idOf('c')])
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.ok(Object.values(r.data.results).every((x) => x.ok), JSON.stringify(r.data))
  const g = await anon.rpc('gallery_media', {})
  assert.equal(g.data.length, 3)
  for (const m of g.data) {
    for (const p of [m.public_preview_path, m.public_thumb_path, m.public_video_path].filter(Boolean)) {
      const res = await fetch(`${URL_}/storage/v1/object/public/gallery/${p}`)
      assert.equal(res.status, 200, p)
    }
  }
  const video = g.data.find((m) => m.kind === 'video')
  const vres = await fetch(`${URL_}/storage/v1/object/public/gallery/${video.public_video_path}`)
  assert.equal(Buffer.compare(Buffer.from(await vres.arrayBuffer()), file('video1.mp4')), 0)
  ok('odobrene stavke javno dostupne u galeriji (video identičan)')
}
{
  const r = await adm('reject', [idOf('b')])
  assert.equal(r.data.results[idOf('b')].ok, true)
  const g = await anon.rpc('gallery_media', {})
  assert.equal(g.data.length, 2)
  const res = await fetch(`${URL_}/storage/v1/object/public/gallery/${idOf('b')}/original.png`)
  assert.notEqual(res.status, 200)
  ok('odbijena stavka uklonjena iz javne galerije')
  const d = await adm('delete', [idOf('b')])
  assert.equal(d.data.results[idOf('b')].ok, true)
  const { data: objs } = await service.storage.from('uploads').list(idOf('b'))
  assert.equal(objs.length, 0)
  ok('obrisana stavka uklonjena iz baze i storagea')
}
{
  const { data: wishes } = await admin.from('wishes').select('*').eq('status', 'pending')
  assert.equal(wishes.length, 1)
  const r = await adm('wish-approve', [wishes[0].id])
  assert.equal(r.status, 200)
  const g = await anon.rpc('gallery_wishes', {})
  assert.equal(g.data.length, 1)
  const c = await anon.rpc('gallery_counts')
  assert.deepEqual(c.data[0], { photos: 1, videos: 1, wishes: 1 })
  ok('čestitka odobrena i vidljiva gostima')
}

// ---------- Ograničenje slanja
{
  let last
  for (let i = 0; i < 10; i++) {
    last = await api('/api/wish', { guestName: 'Brzi', message: `poruka ${i}`, consent: true }, { 'x-test-ip': '10.9.9.9' })
  }
  assert.equal(last.status, 429)
  ok('ograničenje broja čestitki po uređaju')
  const many = Array.from({ length: 21 }, (_, i) => ({ name: `${i}.jpg`, type: 'image/jpeg', size: 1000 }))
  const r = await api('/api/upload/init', { consent: true, files: many })
  assert.equal(r.status, 413)
  ok('najviše 20 datoteka po slanju')
}

console.log(`\nSvi testovi prošli (${passed}).`)
