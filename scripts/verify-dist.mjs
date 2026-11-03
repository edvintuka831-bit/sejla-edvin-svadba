// Provjera produkcijskog builda: da li dist sadrži sve što pozivnica treba.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const required = [
  'index.html',
  'admin/index.html',
  'og-image.jpg',
  'audio/jedina.mp3',
  'favicon.svg',
  'apple-touch-icon.png',
  '_headers',
  'robots.txt',
]
let failed = false
const fail = (m) => {
  failed = true
  console.error('✘ ' + m)
}

for (const f of required) {
  const p = join(dist, f)
  if (!existsSync(p) || statSync(p).size === 0) fail(`nedostaje ${f}`)
  else console.log(`✔ ${f} (${(statSync(p).size / 1024).toFixed(0)} KB)`)
}

for (const page of ['index.html', 'admin/index.html']) {
  const html = readFileSync(join(dist, page), 'utf8')
  if (html.includes('%SITE_URL%')) fail(`${page}: ostao je neobrađen %SITE_URL%`)
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
  if (!refs.length) fail(`${page}: nema JS/CSS paketa`)
  for (const r of refs) if (!existsSync(join(dist, r))) fail(`${page}: ne postoji ${r}`)
  console.log(`✔ ${page}: ${refs.length} povezanih datoteka postoji`)
}

const html = readFileSync(join(dist, 'index.html'), 'utf8')
for (const tag of ['og:title', 'og:description', 'og:image', 'twitter:card']) {
  if (!html.includes(tag)) fail(`index.html: nedostaje ${tag}`)
}
const og = html.match(/property="og:image" content="([^"]+)"/)?.[1]
console.log(`✔ og:image = ${og}${og?.startsWith('http') ? '' : '  (relativno – na Netlifyju preko GitHuba postaje apsolutno automatski)'}`)

if (failed) {
  console.error('\nProvjera NIJE prošla.')
  process.exit(1)
}
console.log('\n✔ dist je kompletan i spreman za objavu.')
