// Provjera OBJAVLJENE stranice prije svadbe (sigurnost, privatnost, ograničenja):
//   npm run check:prod -- https://vasa-adresa.netlify.app
// Ne mijenja ništa i ne šalje datoteke. Za potpunu provjeru privatnosti pohrane
// u galeriji treba postojati bar jedna odobrena fotografija (npr. probna).
const site = (process.argv[2] || '').replace(/\/$/, '')
if (!/^https:\/\//.test(site) && !process.env.ALLOW_HTTP) {
  console.error('Upotreba: npm run check:prod -- https://vasa-adresa.netlify.app')
  process.exit(1)
}

let failed = 0
let warned = 0
const pass = (m) => console.log(`  ✔ ${m}`)
const fail = (m) => (failed++, console.log(`  ✘ ${m}`))
const warn = (m) => (warned++, console.log(`  ⚠ ${m}`))
const check = (cond, okMsg, badMsg) => (cond ? pass(okMsg) : fail(badMsg))

const get = (path, init) => fetch(site + path, { redirect: 'manual', ...init })
const postJson = (path, body) =>
  get(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

console.log(`Provjera: ${site}\n`)

console.log('Stranica i zaglavlja')
{
  const res = await get('/')
  check(res.status === 200, 'stranica se otvara', `stranica vraća ${res.status}`)
  const h = (k) => res.headers.get(k) || ''
  check(/default-src 'self'/.test(h('content-security-policy')), 'Content-Security-Policy postoji', 'nema Content-Security-Policy zaglavlja')
  check(/r2\.cloudflarestorage\.com/.test(h('content-security-policy')), 'CSP dozvoljava Cloudflare R2', 'CSP ne dozvoljava R2 – slike se neće prikazati')
  check(h('x-frame-options') === 'DENY', 'zaštita od ugrađivanja (X-Frame-Options)', 'nema X-Frame-Options')
  check(h('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff', 'nema nosniff')
  check(/max-age/.test(h('strict-transport-security')), 'HTTPS obavezan (HSTS)', 'nema HSTS')
  const admin = await get('/admin')
  check(/noindex/.test(admin.headers.get('x-robots-tag') || ''), '/admin nije za pretraživače', '/admin nema noindex')
  const robots = await (await get('/robots.txt')).text()
  check(/Disallow: \//.test(robots), 'robots.txt zabranjuje indeksiranje', 'robots.txt dozvoljava indeksiranje')
}

console.log('\nServerske funkcije i podešavanja')
let cfg
{
  const res = await get('/api/config')
  check(res.status === 200, '/api/config radi (funkcije su objavljene)', `/api/config vraća ${res.status} – objavite preko GitHub veze`)
  cfg = res.ok ? await res.json() : null
  if (cfg) {
    pass(`ograničenja: fotografija ${cfg.maxImageMB} MB, video ${cfg.maxVideoMB} MB, ${cfg.maxFilesPerBatch} datoteka po slanju`)
    if (cfg.tables.length) pass(`stolovi: ${cfg.tables.length} (${cfg.tables.slice(0, 4).map((t) => t.label).join(', ')}${cfg.tables.length > 4 ? ' …' : ''})`)
    else warn('nema definisanih stolova – dodajte ih u administraciji (Stolovi i QR)')
  }
  const me = await (await get('/api/admin/me')).json().catch(() => null)
  if (me?.configured) {
    check(me.configured.sejla, 'šifra za Šejlu postavljena', 'ADMIN_SEJLA_PASSWORD nedostaje ili je kraća od 12 znakova')
    check(me.configured.edvin, 'šifra za Edvina postavljena', 'ADMIN_EDVIN_PASSWORD nedostaje ili je kraća od 12 znakova')
    check(me.configured.session, 'SESSION_SECRET postavljen', 'SESSION_SECRET nedostaje ili je kraći od 32 znaka')
  } else fail('/api/admin/me ne odgovara')
}

console.log('\nZaštita administracije i slanja')
{
  check((await get('/api/admin/stats')).status === 401, 'statistika bez prijave → odbijeno', 'statistika dostupna bez prijave!')
  check((await get('/api/admin/export')).status === 401, 'izvoz originala bez prijave → odbijeno', 'izvoz dostupan bez prijave!')
  const act = await get('/api/admin/action', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-request': '1' }, body: '{"action":"delete","ids":[]}' })
  check(act.status === 401, 'brisanje bez prijave → odbijeno', `brisanje bez prijave vraća ${act.status}!`)
  const tbl = await get('/api/admin/tables', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-admin-request': '1' }, body: '{"tables":[]}' })
  check(tbl.status === 401, 'izmjena stolova bez prijave → odbijeno', `izmjena stolova bez prijave vraća ${tbl.status}!`)
  const noConsent = await postJson('/api/upload/init', { files: [{ name: 'a.jpg', type: 'image/jpeg', size: 1000 }] })
  check(noConsent.status === 400, 'slanje bez saglasnosti → odbijeno', `slanje bez saglasnosti vraća ${noConsent.status}`)
  const exe = await postJson('/api/upload/init', { consent: true, files: [{ name: 'a.exe', type: 'application/x-msdownload', size: 1000 }] })
  check(exe.status === 415, 'nedozvoljen format → odbijeno', `nedozvoljen format vraća ${exe.status}`)
  if (cfg) {
    const big = await postJson('/api/upload/init', { consent: true, files: [{ name: 'v.mp4', type: 'video/mp4', size: (cfg.maxVideoMB + 1) * 1048576 }] })
    check(big.status === 413, `video veći od ${cfg.maxVideoMB} MB → odbijen`, `prevelik video vraća ${big.status}`)
  }
}

console.log('\nGalerija i privatnost pohrane (Cloudflare R2)')
{
  const res = await get('/api/gallery')
  const g = res.ok ? await res.json() : null
  check(Boolean(g), '/api/gallery radi', `/api/gallery vraća ${res.status}`)
  const sample = g?.items?.find((m) => m.previewUrl || m.videoUrl)
  if (!g) {
    /* već prijavljeno */
  } else if (!sample) {
    warn('galerija je prazna – odobrite jednu probnu fotografiju i ponovite provjeru da se testira privatnost pohrane')
  } else {
    const images = g.items.filter((m) => m.kind === 'image')
    check(images.every((m) => !/\/original\.(jpe?g|heic|heif)/.test(m.previewUrl)), 'gostima se ne daju originali fotografija', 'galerija sadrži originale fotografija!')
    const signed = new URL(sample.previewUrl || sample.videoUrl)
    check(/r2\.cloudflarestorage\.com$/.test(signed.hostname), `datoteke dolaze direktno iz R2 (${signed.hostname})`, `neočekivan izvor datoteka: ${signed.hostname}`)
    const viaSigned = await fetch(signed, { headers: { origin: site, range: 'bytes=0-15' } })
    check([200, 206].includes(viaSigned.status), 'potpisani link za odobrenu datoteku radi', `potpisani link vraća ${viaSigned.status}`)
    check(viaSigned.headers.get('access-control-allow-origin') === site, 'CORS dozvoljava ovu stranicu', 'CORS ne dozvoljava ovu stranicu – podesite CORS na bucketu (README)')
    const unsigned = await fetch(`${signed.origin}${signed.pathname}`)
    check([400, 401, 403].includes(unsigned.status), 'ista datoteka BEZ potpisa → odbijeno (bucket je privatan)', `datoteka je dostupna bez potpisa (${unsigned.status}) – bucket je javan!`)
    const bucketPath = signed.pathname.split('/').slice(0, 2).join('/')
    const list = await fetch(`${signed.origin}${bucketPath}?list-type=2`)
    check([400, 401, 403].includes(list.status), 'listanje bucketa bez potpisa → odbijeno', `bucket se može listati bez potpisa (${list.status})!`)
    const evil = await fetch(signed, { method: 'OPTIONS', headers: { origin: 'https://zlonamjerna-stranica.example', 'access-control-request-method': 'PUT' } })
    check(!evil.headers.get('access-control-allow-origin'), 'tuđe stranice ne mogu slati u bucket (CORS)', 'CORS dozvoljava bilo koju stranicu – suzite AllowedOrigins!')
    const tampered = new URL(signed)
    tampered.pathname = tampered.pathname.replace(/[^/]+$/, 'original.jpg')
    check(![200, 206].includes((await fetch(tampered)).status), 'izmijenjen potpisani link (tuđa datoteka) → odbijeno', 'izmijenjen link otvara drugu datoteku!')
  }
}

console.log(`\n${failed ? `✘ ${failed} problem(a)` : '✔ Sve obavezne provjere su prošle'}${warned ? `, ⚠ ${warned} upozorenje(a)` : ''}.`)
console.log('Trošak i zauzeće prostora: administracija → Sistem.')
process.exit(failed ? 1 : 0)
