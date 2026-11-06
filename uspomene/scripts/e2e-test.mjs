// End-to-end test kroz pravi preglednik u MOBILNOM prikazu (iPhone 13 – gost, Pixel 7 – admin).
// Lokalno: lokalni Netlify Blobs + lokalni S3 server umjesto Cloudflare R2 (vidi README).
// Test sam pokreće API (port 8788) s praznom bazom; stranica: SITE (zadano: pokreće vite na 5173).
import { createRequire } from 'node:module'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { AwsClient } from 'aws4fetch'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
const jsQR = require('jsqr')
const { PNG } = require('pngjs')

const root = resolve(import.meta.dirname, '..')
const env = {}
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2]
}
if (!/127\.0\.0\.1|localhost/.test(env.R2_ENDPOINT || '')) throw new Error('test:e2e radi samo lokalno')
const FX = resolve(root, 'scripts/fixtures')
const OUT = process.env.OUT || resolve(root, 'test-results')
mkdirSync(OUT, { recursive: true })
const file = (p) => readFileSync(p.startsWith('/') ? p : resolve(FX, p))

// --- čisto stanje: prazan bucket i prazna baza
const s3 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: env.R2_REGION })
const bucketUrl = `${env.R2_ENDPOINT}/${env.R2_BUCKET}`
const listing = await (await s3.fetch(`${bucketUrl}?list-type=2&max-keys=1000`)).text()
for (const key of [...listing.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1])) await s3.fetch(`${bucketUrl}/${key}`, { method: 'DELETE' })

const children = []
const start = (args, extraEnv, ready) =>
  new Promise((res) => {
    const p = spawn(args[0], args.slice(1), { cwd: root, env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(p)
    const onData = (d) => ready.test(String(d)) && res(p)
    p.stdout.on('data', onData)
    p.stderr.on('data', onData)
  })
process.on('exit', () => children.forEach((c) => c.kill()))
await start([process.execPath, 'scripts/dev-api.mjs'], { BLOBS_DIR: mkdtempSync(resolve(tmpdir(), 'uspomene-e2e-')) }, /API:/)
const SITE = process.env.SITE || 'http://localhost:5173'
if (!process.env.SITE) await start([process.execPath, 'node_modules/vite/bin/vite.js', '--port', '5173', '--strictPort'], {}, /Local/)
// ista stranica, ali kao da je objavljena na konačnoj adresi (za prave QR kodove)
const FINAL = 'https://galerija-test.example'
const SITE_FINAL = 'http://localhost:5174'
await start([process.execPath, 'node_modules/vite/bin/vite.js', '--port', '5174', '--strictPort'], { VITE_PUBLIC_SITE_URL: FINAL }, /Local/)

// Veći video (~60 MB) za provjeru napretka slanja
const bigVideo = resolve(OUT, 'veliki-video.mp4')
if (!existsSync(bigVideo)) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'nullsrc=s=1280x720:r=30,geq=random(1)*255:128:128', '-t', '8', '-c:v', 'libx264', '-b:v', '60M', '-maxrate', '60M', '-bufsize', '10M', '-pix_fmt', 'yuv420p', bigVideo])
}

function jpegSize(buf) {
  let i = 2
  while (i < buf.length) {
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xc3) return `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}`
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}

// Izvuci slike kartica iz PDF-a i dekodiraj QR kodove (redom)
function decodePdfQrs(pdf) {
  const dir = mkdtempSync(resolve(tmpdir(), 'pdfimg-'))
  execFileSync('pdfimages', ['-png', pdf, `${dir}/k`])
  return readdirSync(dir).sort().map((f) => {
    const img = PNG.sync.read(readFileSync(`${dir}/${f}`))
    return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data || null
  })
}

let n = 0
const ok = (s) => console.log(`  ✔ ${s}`, ++n)
const browser = await chromium.launch()
const errors = []
const track = (page, who) => {
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`))
  page.on('console', (m) => ['warning', 'error'].includes(m.type()) && console.log(`    [${who} ${m.type()}] ${m.text()}`))
}

console.log('Šejla & Edvin · Uspomene · E2E test (mobilni prikaz)')

// ================= ŠEJLA (Pixel 7): stolovi i QR =================
const sejlaCtx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true })
await sejlaCtx.addInitScript(() => {
  delete window.showSaveFilePicker // kao na telefonu
})
const sejla = await sejlaCtx.newPage()
track(sejla, 'sejla')
await sejla.goto(`${SITE}/admin`, { waitUntil: 'networkidle' })
await sejla.getByRole('radio', { name: 'Šejla' }).click()
await sejla.getByLabel('Šifra').fill('pogresna-sifra-123')
await sejla.getByRole('button', { name: 'Prijava' }).click()
await sejla.getByText('Pogrešna šifra.').waitFor()
await sejla.getByLabel('Šifra').fill(env.ADMIN_SEJLA_PASSWORD)
await sejla.getByRole('button', { name: 'Prijava' }).click()
await sejla.getByText('Prijavljeni: Šejla').waitFor()
ok('Šejla: pogrešna šifra odbijena, prijava uspješna')

await sejla.getByRole('tab', { name: 'Stolovi i QR' }).click()
await sejla.getByTestId('table-rows').waitFor()
const labels = await sejla.locator('.table-row input[aria-label="Naziv stola"]').evaluateAll((els) => els.map((e) => e.value))
assert.deepEqual(labels, Array.from({ length: 10 }, (_, i) => `Stol ${i + 1}`))
ok('zadano 10 stolova: Stol 1 … Stol 10')

// izmjena kroz administraciju (dodaj pa ukloni) – bez mijenjanja aplikacije
await sejla.getByRole('button', { name: /Dodaj stol/ }).click()
await sejla.getByPlaceholder('npr. Stol 7').last().fill('Mladenački stol')
await sejla.getByRole('button', { name: 'Spremi stolove' }).click()
await sejla.getByText('Spremljeno: 11 stolova').waitFor()
assert.equal(await sejla.locator('.table-id').last().inputValue(), 'mladenacki-stol')
await sejla.getByRole('button', { name: 'Ukloni Mladenački stol' }).click()
await sejla.getByRole('button', { name: 'Spremi stolove' }).click()
await sejla.getByText('Spremljeno: 10 stolova').waitFor()
ok('stolovi se mijenjaju u administraciji (dodavanje, oznaka u linku, uklanjanje)')

// privremena adresa → samo UZORAK bez QR kodova
await sejla.getByTestId('address-temporary').waitFor()
assert.equal(await sejla.locator('.qr-item canvas').count(), 0)
const [sample] = await Promise.all([sejla.waitForEvent('download', { timeout: 60_000 }), sejla.getByTestId('pdf-a4').click()])
assert.match(sample.suggestedFilename(), /UZORAK\.pdf$/)
await sample.saveAs(`${OUT}/kartice-UZORAK-A4.pdf`)
assert.match(execFileSync('pdfinfo', [`${OUT}/kartice-UZORAK-A4.pdf`]).toString(), /Pages:\s+3/)
const sampleQrs = decodePdfQrs(`${OUT}/kartice-UZORAK-A4.pdf`)
assert.equal(sampleQrs.filter(Boolean).length, 0, 'uzorak ne smije imati QR')
ok('privremena adresa: PDF je UZORAK (3 stranice A4, 10 kartica) bez ijednog QR koda')

// konačna adresa → pravi QR kodovi u PDF-u
const finalPage = await sejlaCtx.newPage()
track(finalPage, 'sejla-final')
await finalPage.goto(`${SITE_FINAL}/admin`, { waitUntil: 'networkidle' })
await finalPage.getByText('Prijavljeni: Šejla').waitFor() // ista prijava (kolačić vrijedi za cijeli host)
await finalPage.getByRole('tab', { name: 'Stolovi i QR' }).click()
await finalPage.getByTestId('address-final').waitFor()
assert.equal(await finalPage.locator('.qr-item canvas').count(), 10)
for (const [layout, pages] of [['a4', 3], ['a6', 10]]) {
  const [dl] = await Promise.all([finalPage.waitForEvent('download', { timeout: 60_000 }), finalPage.getByTestId(`pdf-${layout}`).click()])
  const path = `${OUT}/kartice-${layout.toUpperCase()}.pdf`
  await dl.saveAs(path)
  assert.match(execFileSync('pdfinfo', [path]).toString(), new RegExp(`Pages:\\s+${pages}\\b`))
  const qrs = decodePdfQrs(path)
  assert.deepEqual(qrs, Array.from({ length: 10 }, (_, i) => `${FINAL}/?sto=${i + 1}`), qrs.join(','))
}
const [png] = await Promise.all([finalPage.waitForEvent('download', { timeout: 60_000 }), finalPage.getByTestId('qr-zip').click()])
await png.saveAs(`${OUT}/kartice-png.zip`)
execFileSync('unzip', ['-o', '-q', `${OUT}/kartice-png.zip`, '-d', `${OUT}/kartice-png`])
await finalPage.screenshot({ path: `${OUT}/1-admin-stolovi.png`, fullPage: true })
await finalPage.close()
ok('konačna adresa: PDF A4 (3 str.) i A6 (10 str.) – svih 10 QR kodova dekodirano u tačan link svog stola')

// ================= GOST sa stola 2 (iPhone 13) =================
const guestCtx = await browser.newContext({ ...devices['iPhone 13'] })
const guest = await guestCtx.newPage()
track(guest, 'gost')
await guest.goto(`${SITE}/?sto=2`, { waitUntil: 'networkidle' })
await guest.getByTestId('table-badge').waitFor()
assert.equal(await guest.getByTestId('table-badge').textContent(), 'Stol 2')
await guest.screenshot({ path: `${OUT}/2-gost-naslovna.png` })
ok('gost skenira QR stola 2 → stranica automatski prikazuje „Stol 2“')

await guest.getByPlaceholder('npr. Amra i Kenan').fill('Amra i Kenan')
await guest.getByTestId('file-input').setInputFiles([
  ...['photo-gps.jpg', 'photo2.jpg', 'photo4.png', 'video1.mp4', 'fake.jpg', 'notes.txt'].map((f) => resolve(FX, f)),
  bigVideo,
])
await guest.waitForSelector('.file-tile >> nth=6')
assert.equal(await guest.locator('.file-tile[data-status="invalid"]').count(), 1)
await guest.locator('#posalji .consent input').check()
const progressSeen = new Set()
const poll = setInterval(async () => {
  const t = await guest.locator('.file-tile[data-status="uploading"] .file-status').allTextContents().catch(() => [])
  t.forEach((x) => progressSeen.add(x.trim()))
}, 40)
await guest.getByRole('button', { name: /Pošalji 6 datoteka/ }).click()
await guest.waitForFunction(
  () => {
    const s = [...document.querySelectorAll('#posalji .file-tile')].map((e) => e.dataset.status)
    return s.every((x) => ['done', 'error', 'invalid'].includes(x))
  },
  null,
  { timeout: 180_000 },
)
clearInterval(poll)
const statuses = await guest.$$eval('#posalji .file-tile', (els) => els.map((e) => e.dataset.status))
assert.equal(statuses.filter((s) => s === 'done').length, 5, statuses.join(','))
assert.match(await guest.locator('.file-tile[data-status="error"] .file-error').textContent(), /ne odgovara/)
assert.ok([...progressSeen].some((t) => /Šalje se \d+%/.test(t)), [...progressSeen].join(' | '))
await guest.locator('#posalji').screenshot({ path: `${OUT}/3-gost-slanje.png` })
ok(`5 datoteka poslano (uključujući video od ${(statSync(bigVideo).size / 1048576).toFixed(0)} MB) uz napredak u %; lažna slika odbijena`)

await guest.locator('#cestitka textarea').fill('Draga Šejla i dragi Edvine, neka vam ljubav traje vječno! ❤')
await guest.locator('#cestitka .consent input').check()
await guest.getByRole('button', { name: /Pošalji čestitku/ }).click()
await guest.getByText('Hvala Vam na lijepim riječima').waitFor()
await guest.reload({ waitUntil: 'networkidle' })
await guest.locator('#galerija').scrollIntoViewIfNeeded()
await guest.getByText('Još nema odobrenih uspomena').waitFor()
ok('čestitka poslana; prije odobrenja galerija je prazna')

// gost sa stola 10 – ista zajednička galerija
const guest2Ctx = await browser.newContext({ ...devices['iPhone 13'] })
const guest2 = await guest2Ctx.newPage()
track(guest2, 'gost2')
await guest2.goto(`${SITE}/?sto=10`, { waitUntil: 'networkidle' })
assert.equal(await guest2.getByTestId('table-badge').textContent(), 'Stol 10')
await guest2.getByTestId('file-input').setInputFiles([resolve(FX, 'photo1.jpg')])
await guest2.locator('#posalji .consent input').check()
await guest2.getByRole('button', { name: /Pošalji 1 datoteku/ }).click()
await guest2.locator('.file-tile[data-status="done"]').waitFor({ timeout: 30_000 })
ok('gost sa „Stol 10“ šalje u istu galeriju')

// ================= ŠEJLA: moderacija =================
await sejla.getByRole('tab', { name: /Na čekanju/ }).click()
await sejla.locator('[data-testid="media-card"]').first().waitFor()
await sejla.getByRole('button', { name: 'Osvježi' }).click()
await sejla.waitForFunction(() => document.querySelectorAll('[data-testid="media-card"]').length === 6)
await sejla.locator('select.select').selectOption({ label: 'Stol 10' })
await sejla.waitForFunction(() => document.querySelectorAll('[data-testid="media-card"]').length === 1)
await sejla.locator('select.select').selectOption({ label: 'Svi stolovi' })
await sejla.waitForFunction(() => document.querySelectorAll('[data-testid="media-card"]').length === 6)
await sejla.screenshot({ path: `${OUT}/4-admin-na-cekanju.png`, fullPage: true })
ok('admin vidi 6 stavki na čekanju; filter po stolu radi')

await sejla.locator('[data-testid="media-card"] .media-thumb').first().click()
await sejla.locator('.viewer-media img, .viewer-media video').first().waitFor()
await sejla.locator('.viewer-close').click()
await sejla.getByText(/Označi sve/).click()
await sejla.getByRole('button', { name: 'Odobri (6)' }).click()
await sejla.getByText('Odobreno: 6.').waitFor({ timeout: 30_000 })
await sejla.getByRole('tab', { name: /Čestitke/ }).click()
await sejla.locator('[data-testid="wish-card"]').first().waitFor()
assert.match(await sejla.locator('[data-testid="wish-card"]').first().textContent(), /Stol 2/)
await sejla.getByRole('button', { name: 'Objavi', exact: true }).click()
await sejla.getByText('Čestitka objavljena.').waitFor()
ok('Šejla pregledala i grupno odobrila 6 stavki i čestitku (sa oznakom stola)')

// pregled po stolovima
await sejla.getByRole('tab', { name: 'Stolovi i QR' }).click()
await sejla.waitForFunction(() => document.querySelectorAll('.table-count')[1]?.textContent.trim() === '5 / 5')
assert.equal((await sejla.locator('.table-count').nth(9).textContent()).trim(), '1 / 1')
await sejla.getByRole('button', { name: 'Fotografije: Stol 10' }).click()
await sejla.waitForFunction(() => document.querySelectorAll('[data-testid="media-card"]').length === 1)
assert.equal(await sejla.locator('select.select').inputValue(), '10')
ok('pregled po stolovima: Stol 2 – 5 poslano / 5 odobreno, Stol 10 – 1 / 1; otvaranje fotografija stola')

// ================= GOST: galerija =================
await guest.reload({ waitUntil: 'networkidle' })
await guest.locator('#galerija').scrollIntoViewIfNeeded()
await guest.locator('.masonry-item').nth(5).waitFor()
assert.equal(await guest.locator('.masonry-item').count(), 6)
await guest.waitForFunction(() => [...document.querySelectorAll('.masonry-item img')].every((i) => i.complete && i.naturalWidth > 0))
assert.match(await guest.locator('.masonry-item .by').allTextContents().then((t) => t.join('|')), /Stol 10/)
await guest.locator('#galerija').screenshot({ path: `${OUT}/5-gost-galerija.png` })
const videoItem = guest.locator('.masonry-item', { has: guest.locator('.play') }).first()
await videoItem.locator('button').click()
await guest.locator('.lightbox video').waitFor()
await guest.waitForFunction(() => document.querySelector('.lightbox video').readyState >= 1, null, { timeout: 20_000 })
await guest.screenshot({ path: `${OUT}/6-gost-video.png` })
await guest.locator('.lb-next').click()
await guest.locator('.lb-close').click()
await guest.getByRole('tab', { name: /Čestitke/ }).click()
await guest.getByText('neka vam ljubav traje vječno').waitFor()
ok('gost vidi 6 odobrenih uspomena oba stola, video se reproducira, čestitka vidljiva')

// javna kopija: bez EXIF/GPS i ispravno okrenuta; original nikad nije u galeriji
const gallery = await (await fetch('http://127.0.0.1:8788/api/gallery')).json()
for (const m of gallery.items.filter((x) => x.kind === 'image')) {
  const buf = Buffer.from(await (await fetch(m.previewUrl)).arrayBuffer())
  assert.ok(!buf.includes(Buffer.from('Exif')) && !buf.includes(Buffer.from('TestPhone')), 'pregled ima EXIF')
}
assert.ok(!JSON.stringify(gallery).includes('original.jpg'))
const sizes = await Promise.all(gallery.items.filter((x) => x.kind === 'image').map(async (m) => jpegSize(Buffer.from(await (await fetch(m.previewUrl)).arrayBuffer()))))
assert.ok(sizes.includes('1500x2000'), sizes.join(','))
ok('galerija daje samo preglede bez EXIF/GPS (uspravno okrenute), nikad originale')

// ================= ŠEJLA: preuzimanje =================
await sejla.getByRole('tab', { name: 'Odobreno' }).click()
await sejla.locator('[data-testid="media-card"]').first().waitFor()
const vCard = sejla.locator('[data-testid="media-card"]').filter({ has: sejla.locator('.kind') }).filter({ hasText: /9[0-9] KB/ })
const [dl] = await Promise.all([sejla.waitForEvent('download'), vCard.getByRole('button', { name: /Original/ }).click()])
await dl.saveAs(`${OUT}/original-video.mp4`)
assert.equal(Buffer.compare(file(`${OUT}/original-video.mp4`), file('video1.mp4')), 0)
ok(`original videa preuzet bajt-po-bajt identičan (${dl.suggestedFilename()})`)

await sejla.getByRole('tab', { name: 'Preuzimanje' }).click()
await sejla.getByRole('button', { name: 'Pripremi arhivu' }).click()
const [zip] = await Promise.all([sejla.waitForEvent('download', { timeout: 120_000 }), sejla.getByTestId('download-part').first().click()])
await zip.saveAs(`${OUT}/arhiva.zip`)
await sejla.getByText(/je preuzet/).waitFor()
const zl = execFileSync('unzip', ['-l', `${OUT}/arhiva.zip`]).toString()
assert.equal((zl.match(/fotografije\//g) || []).length, 4, zl)
assert.equal((zl.match(/videozapisi\//g) || []).length, 2, zl)
execFileSync('unzip', ['-o', '-q', `${OUT}/arhiva.zip`, '-d', `${OUT}/arhiva`])
const bigInZip = zl.match(/videozapisi\/\S*veliki-video\.mp4/)[0]
assert.equal(Buffer.compare(file(`${OUT}/arhiva/${bigInZip}`), file(bigVideo)), 0)
const gpsInZip = zl.match(/fotografije\/\S*photo-gps\.jpg/)[0]
assert.match(gpsInZip, /Stol_2/)
assert.equal(Buffer.compare(file(`${OUT}/arhiva/${gpsInZip}`), file('photo-gps.jpg')), 0)
assert.match(readFileSync(`${OUT}/arhiva/cestitke/cestitke.csv`, 'utf8'), /neka vam ljubav traje/)
ok('kompletna ZIP arhiva: 4 fotografije + 2 videa (originali identični, s oznakom stola) + čestitke')

// ================= EDVIN: druga prijava, uklanjanje =================
const edvinCtx = await browser.newContext({ ...devices['Pixel 7'] })
const edvin = await edvinCtx.newPage()
track(edvin, 'edvin')
await edvin.goto(`${SITE}/admin`, { waitUntil: 'networkidle' })
await edvin.getByRole('radio', { name: 'Edvin' }).click()
await edvin.getByLabel('Šifra').fill(env.ADMIN_SEJLA_PASSWORD)
await edvin.getByRole('button', { name: 'Prijava' }).click()
await edvin.getByText('Pogrešna šifra.').waitFor()
await edvin.getByLabel('Šifra').fill(env.ADMIN_EDVIN_PASSWORD)
await edvin.getByRole('button', { name: 'Prijava' }).click()
await edvin.getByText('Prijavljeni: Edvin').waitFor()
await edvin.getByRole('tab', { name: 'Odobreno' }).click()
await edvin.locator('[data-testid="media-card"]').first().waitFor()
await edvin.locator('[data-testid="media-card"]').first().getByRole('button', { name: /Ukloni iz galerije/ }).click()
await edvin.getByText('Odbijeno: 1.').waitFor()
edvin.once('dialog', (d) => d.accept())
await edvin.getByRole('tab', { name: 'Odbijeno' }).click()
await edvin.locator('[data-testid="media-card"]').first().getByRole('button', { name: /Obriši/ }).click()
await edvin.getByText('Obrisano: 1.').waitFor()
await guest.reload({ waitUntil: 'networkidle' })
await guest.locator('#galerija').scrollIntoViewIfNeeded()
await guest.locator('.masonry-item').nth(4).waitFor()
assert.equal(await guest.locator('.masonry-item').count(), 5)
ok('Edvin (Šejlina šifra ne vrijedi za njegov račun) uklanja i briše – gost više ne vidi stavku')

await edvin.getByRole('tab', { name: 'Sistem' }).click()
await edvin.getByTestId('checks').waitFor()
assert.equal(await edvin.locator('.checks li.bad').count(), 0, await edvin.locator('.checks').textContent())
assert.equal(await edvin.getByTestId('cost').textContent(), '0.00 $')
await edvin.screenshot({ path: `${OUT}/7-admin-sistem.png`, fullPage: true })
ok('provjera sistema: sve stavke u redu, procijenjeni trošak 0,00 $')

await browser.close()
assert.deepEqual(errors, [], errors.join('\n'))
console.log(`\nSvi E2E testovi prošli (${n}). Snimke ekrana: ${OUT}`)
process.exit(0)
