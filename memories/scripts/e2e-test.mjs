// End-to-end test kroz pravi preglednik u MOBILNOM prikazu (iPhone 13 i Pixel 7),
// na LOKALNOM Supabaseu:  gost šalje → admin odobrava → gost vidi → admin preuzima.
//   npx supabase start
//   npm run dev:api      (terminal 1)
//   npm run dev          (terminal 2)
//   npm run test:api     (napravi probne administratore)
//   npm run test:e2e
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')

const root = resolve(import.meta.dirname, '..')
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) process.env[m[1]] ??= m[2]
}
const URL_ = process.env.VITE_SUPABASE_URL
if (!/127\.0\.0\.1|localhost/.test(URL_)) throw new Error('test:e2e radi samo na lokalnom Supabaseu')
const SITE = process.env.SITE || 'http://localhost:5173'
const FX = resolve(root, 'scripts/fixtures')
const OUT = process.env.OUT || resolve(root, 'test-results')
mkdirSync(OUT, { recursive: true })
const PASS = 'Probna-Sifra-2027!'
const service = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

let n = 0
function jpegSize(buf) {
  let i = 2
  while (i < buf.length) {
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc3) return `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}`
    i += 2 + len
  }
  return null
}
const ok = (s) => console.log(`  ✔ ${s}`, ++n)

// čisto stanje
await service.from('rate_events').delete().gte('id', 0)
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

const browser = await chromium.launch()
const errors = []
const track = (page, who) => {
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`))
}

console.log('Šejla & Edvin · E2E test (mobilni prikaz)')

// ================= GOST (iPhone 13) =================
const guestCtx = await browser.newContext({ ...devices['iPhone 13'] })
const guest = await guestCtx.newPage()
track(guest, 'gost')
await guest.goto(SITE, { waitUntil: 'networkidle' })
await guest.locator('#posalji').scrollIntoViewIfNeeded()
await guest.getByPlaceholder('npr. Amra i Kenan').fill('Amra i Kenan')
await guest.getByTestId('file-input').setInputFiles(
  ['photo-gps.jpg', 'photo2.jpg', 'photo4.png', 'video1.mp4', 'fake.jpg', 'notes.txt'].map((f) => resolve(FX, f)),
)
await guest.waitForSelector('.file-tile >> nth=5')
assert.equal(await guest.locator('.file-tile[data-status="invalid"]').count(), 1)
ok('izbor više datoteka odjednom; nedozvoljen format označen prije slanja')

await guest.getByRole('button', { name: /Pošalji 5 datoteka/ }).click()
await guest.getByText('Prije slanja potvrdite saglasnost').waitFor()
ok('slanje bez saglasnosti blokirano s jasnom porukom')

await guest.locator('#posalji .consent input').check()
await guest.getByRole('button', { name: /Pošalji 5 datoteka/ }).click()
await guest.waitForFunction(
  () => {
    const s = [...document.querySelectorAll('#posalji .file-tile')].map((e) => e.dataset.status)
    return s.length && s.every((x) => ['done', 'error', 'invalid'].includes(x))
  },
  null,
  { timeout: 60_000 },
)
const statuses = await guest.$$eval('#posalji .file-tile', (els) => els.map((e) => e.dataset.status))
assert.deepEqual(statuses.filter((s) => s === 'done').length, 4, statuses.join(','))
assert.deepEqual(statuses.filter((s) => s === 'error').length, 1)
const fakeError = await guest.locator('.file-tile[data-status="error"] .file-error').textContent()
assert.match(fakeError, /ne odgovara/)
await guest.locator('#posalji .notice-error').first().waitFor()
await guest.locator('#posalji').screenshot({ path: `${OUT}/1-gost-slanje.png` })
ok('4 datoteke poslane s napretkom; lažna slika odbijena s porukom greške')

await guest.locator('#cestitka').scrollIntoViewIfNeeded()
await guest.locator('#cestitka textarea').fill('Draga Šejla i dragi Edvine, neka vam ljubav traje vječno! ❤')
await guest.locator('#cestitka .consent input').check()
await guest.getByRole('button', { name: /Pošalji čestitku/ }).click()
await guest.getByText('Hvala Vam na lijepim riječima').waitFor()
ok('čestitka poslana (ime zapamćeno iz prvog polja)')

await guest.reload({ waitUntil: 'networkidle' })
await guest.locator('#galerija').scrollIntoViewIfNeeded()
await guest.getByText('Još nema odobrenih uspomena').waitFor()
ok('prije odobrenja galerija je prazna')

// ================= ADMIN (Pixel 7, Android) =================
const adminCtx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true })
await adminCtx.addInitScript(() => {
  delete window.showSaveFilePicker // kao na telefonu
})
const admin = await adminCtx.newPage()
track(admin, 'admin')
await admin.goto(`${SITE}/admin`, { waitUntil: 'networkidle' })
await admin.getByLabel('Email').fill('admin1@test.local')
await admin.getByLabel('Šifra').fill('pogresna-sifra-123')
await admin.getByRole('button', { name: 'Prijava' }).click()
await admin.getByText('Pogrešan email ili šifra').waitFor()
ok('pogrešna šifra odbijena')

await admin.getByLabel('Šifra').fill(PASS)
await admin.getByRole('button', { name: 'Prijava' }).click()
await admin.getByTestId('stats').waitFor()
await admin.locator('[data-testid="media-card"]').first().waitFor()
assert.equal(await admin.locator('[data-testid="media-card"]').count(), 4)
const pendingStat = await admin.locator('.stat').first().textContent()
assert.match(pendingStat, /Na čekanju4/)
await admin.screenshot({ path: `${OUT}/2-admin-na-cekanju.png`, fullPage: true })
ok('admin prijava; 4 stavke na čekanju i statistika')

await admin.locator('[data-testid="media-card"] .media-thumb').first().click()
await admin.locator('.viewer-media img, .viewer-media video').first().waitFor()
await admin.screenshot({ path: `${OUT}/3-admin-pregled.png` })
await admin.locator('.viewer-close').click()
ok('pregled stavke u punoj veličini')

await admin.getByText(/Označi sve/).click()
await admin.getByRole('button', { name: 'Odobri (4)' }).click()
await admin.getByText('Odobreno: 4.').waitFor({ timeout: 30_000 })
ok('grupno odobravanje 4 stavke')

await admin.getByRole('tab', { name: /Čestitke/ }).click()
await admin.locator('[data-testid="wish-card"]').first().waitFor()
await admin.getByRole('button', { name: 'Objavi', exact: true }).click()
await admin.getByText('Čestitka objavljena.').waitFor()
ok('moderacija čestitke (objava)')

// preuzimanje originala
await admin.getByRole('tab', { name: 'Odobreno' }).click()
await admin.locator('[data-testid="media-card"]').first().waitFor()
const card = admin.locator('[data-testid="media-card"]', { hasText: 'Amra' }).filter({ has: admin.locator('.kind') })
const [dl] = await Promise.all([admin.waitForEvent('download'), card.getByRole('button', { name: /Original/ }).click()])
const videoPath = `${OUT}/original-video.mp4`
await dl.saveAs(videoPath)
assert.equal(Buffer.compare(readFileSync(videoPath), readFileSync(resolve(FX, 'video1.mp4'))), 0)
ok(`preuzet original videa – bajt-po-bajt identičan (${dl.suggestedFilename()})`)

// kompletna arhiva
await admin.getByRole('tab', { name: 'Preuzimanje' }).click()
await admin.getByRole('button', { name: 'Pripremi arhivu' }).click()
const [zipDl] = await Promise.all([admin.waitForEvent('download', { timeout: 60_000 }), admin.getByTestId('download-part').first().click()])
const zipPath = `${OUT}/arhiva.zip`
await zipDl.saveAs(zipPath)
await admin.getByText(/je preuzet/).waitFor()
const listing = execFileSync('unzip', ['-l', zipPath]).toString()
assert.match(listing, /cestitke\/cestitke\.csv/)
assert.equal((listing.match(/fotografije\//g) || []).length, 3, listing)
assert.equal((listing.match(/videozapisi\//g) || []).length, 1, listing)
execFileSync('unzip', ['-o', '-q', zipPath, '-d', `${OUT}/arhiva`])
const gpsName = listing.match(/fotografije\/\S*photo-gps\.jpg/)[0]
assert.equal(Buffer.compare(readFileSync(`${OUT}/arhiva/${gpsName}`), readFileSync(resolve(FX, 'photo-gps.jpg'))), 0)
assert.match(readFileSync(`${OUT}/arhiva/cestitke/cestitke.csv`, 'utf8'), /neka vam ljubav traje/)
await admin.screenshot({ path: `${OUT}/4-admin-arhiva.png` })
ok('kompletna ZIP arhiva: 3 fotografije + 1 video (originali identični) + čestitke')

// QR
await admin.getByRole('tab', { name: 'QR kod' }).click()
await admin.getByTestId('qr-canvas').waitFor()
const [qrDl] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name: /Kartica za štampu/ }).click()])
await qrDl.saveAs(`${OUT}/qr-kartica.png`)
await admin.screenshot({ path: `${OUT}/5-admin-qr.png`, fullPage: true })
ok('QR kod i kartica za štampu se generišu')

// ================= GOST VIDI ODOBRENO =================
await guest.reload({ waitUntil: 'networkidle' })
await guest.locator('#galerija').scrollIntoViewIfNeeded()
await guest.locator('.masonry-item').nth(3).waitFor()
assert.equal(await guest.locator('.masonry-item').count(), 4)
await guest.waitForFunction(() => [...document.querySelectorAll('.masonry-item img')].every((i) => i.complete && i.naturalWidth > 0))
await guest.locator('#galerija').screenshot({ path: `${OUT}/6-gost-galerija.png` })
ok('gost vidi 4 odobrene stavke, sve sličice učitane')

await guest.locator('.masonry-item button').first().click()
await guest.locator('.lightbox').waitFor()
const first = await guest.locator('.lb-count').textContent()
const box = await guest.locator('.lightbox').boundingBox()
await guest.touchscreen.tap(box.width / 2, box.height / 2).catch(() => {})
await guest.locator('.lb-next').click()
assert.notEqual(await guest.locator('.lb-count').textContent(), first)
await guest.screenshot({ path: `${OUT}/7-gost-lightbox.png` })
await guest.locator('.lb-close').click()
ok('pregled preko cijelog ekrana i listanje')

// javna kopija je bez GPS/EXIF podataka i pravilno okrenuta
const { data: gal } = await service.from('media').select('original_name, public_preview_path, status').eq('original_name', 'photo-gps.jpg').single()
const pub = Buffer.from(await (await fetch(`${URL_}/storage/v1/object/public/gallery/${gal.public_preview_path}`)).arrayBuffer())
assert.ok(!pub.includes(Buffer.from('Exif')), 'javni pregled ne smije imati EXIF')
assert.ok(!pub.includes(Buffer.from('TestPhone')))
const dims = jpegSize(pub)
assert.equal(dims, '1500x2000', dims) // original 2000×1500 + EXIF orijentacija 6 → uspravno
const priv = await fetch(`${URL_}/storage/v1/object/public/uploads/${gal.public_preview_path.split('/')[0]}/original.jpg`)
assert.notEqual(priv.status, 200)
ok('javna kopija bez EXIF/GPS, pravilno okrenuta (1500×2000); original nije javan')

await guest.getByRole('tab', { name: /Čestitke/ }).click()
await guest.getByText('neka vam ljubav traje vječno').waitFor()
ok('gost vidi odobrenu čestitku')

// admin: uklanjanje iz galerije
await admin.getByRole('tab', { name: 'Odobreno' }).click()
await admin.locator('[data-testid="media-card"]').first().waitFor()
await admin.locator('[data-testid="media-card"]').first().getByRole('button', { name: /Ukloni iz galerije/ }).click()
await admin.getByText('Odbijeno: 1.').waitFor()
admin.once('dialog', (d) => d.accept())
await admin.getByRole('tab', { name: 'Odbijeno' }).click()
await admin.locator('[data-testid="media-card"]').first().getByRole('button', { name: /Obriši/ }).click()
await admin.getByText('Obrisano: 1.').waitFor()
await guest.reload({ waitUntil: 'networkidle' })
await guest.locator('#galerija').scrollIntoViewIfNeeded()
await guest.locator('.masonry-item').nth(2).waitFor()
assert.equal(await guest.locator('.masonry-item').count(), 3)
ok('uklanjanje i brisanje – gost više ne vidi stavku')

await browser.close()
assert.deepEqual(errors, [], errors.join('\n'))
console.log(`\nSvi E2E testovi prošli (${n}). Snimke ekrana: ${OUT}`)
