// Pakuje dist/ u isporuka/sejla-edvin-mladozenja.zip (index.html je u korijenu ZIP-a – spremno za Netlify).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'

const dist = 'dist'
const files = {}
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else files[relative(dist, p).split('\\').join('/')] = [readFileSync(p), { level: /\.(mp3|jpg|png|woff2?)$/.test(name) ? 0 : 9 }]
  }
}
walk(dist)
mkdirSync('isporuka', { recursive: true })
const out = 'isporuka/sejla-edvin-mladozenja.zip'
writeFileSync(out, zipSync(files))
console.log(`✔ ${out} – ${Object.keys(files).length} datoteka, ${(statSync(out).size / 1048576).toFixed(2)} MB`)
