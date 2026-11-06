// QR kod za konačnu javnu adresu stranice:
//   npm run qr -- https://vasa-adresa.netlify.app
// Pravi qr/qr.svg i qr/qr.png (2000 px). Kartice za svaki sto: /admin → Stolovi i QR.
// Za sto: npm run qr -- "https://vasa-adresa.netlify.app/?sto=7"
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import QRCode from 'qrcode'

const url = process.argv[2]
if (!url || !/^https:\/\/\S+$/.test(url)) {
  console.error('Upotreba: npm run qr -- https://vasa-konacna-adresa.netlify.app')
  process.exit(1)
}
const out = resolve(import.meta.dirname, '..', 'qr')
mkdirSync(out, { recursive: true })
const opts = { errorCorrectionLevel: 'H', margin: 2, color: { dark: '#2f2210', light: '#ffffff' } }
await QRCode.toFile(resolve(out, 'qr.svg'), url, { ...opts, type: 'svg' })
await QRCode.toFile(resolve(out, 'qr.png'), url, { ...opts, width: 2000 })
console.log(`QR kod za ${url} snimljen u ${out}`)
