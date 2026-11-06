import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { PUBLIC_SITE_URL, WEDDING } from '../lib/config.js'
import { IconDownload } from '../components/Icons.jsx'

const DARK = '#2f2210'
const LIGHT = '#ffffff'

function save(href, name) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
}

// Kartica za štampu (A6 omjer, 1240×1748 px ≈ 300 dpi)
async function renderCard(url) {
  await Promise.all([
    document.fonts.load('120px "Great Vibes"'),
    document.fonts.load('40px "Cinzel"'),
    document.fonts.load('italic 40px "Cormorant Garamond"'),
  ]).catch(() => {})
  const W = 1240
  const H = 1748
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#fffdf8')
  bg.addColorStop(1, '#f7efe2')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const gold = ctx.createLinearGradient(0, 0, W, H)
  gold.addColorStop(0, '#d9bd7f')
  gold.addColorStop(0.5, '#b8924a')
  gold.addColorStop(1, '#8a672b')
  ctx.strokeStyle = gold
  ctx.lineWidth = 6
  ctx.strokeRect(46, 46, W - 92, H - 92)
  ctx.lineWidth = 2
  ctx.strokeRect(70, 70, W - 140, H - 140)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a672b'
  ctx.font = '38px "Cinzel", serif'
  ctx.fillText('W E D D I N G   M E M O R I E S', W / 2, 220)
  ctx.fillStyle = gold
  ctx.font = '150px "Great Vibes", cursive'
  ctx.fillText(`${WEDDING.bride} & ${WEDDING.groom}`, W / 2, 400)
  ctx.fillStyle = '#45341f'
  ctx.font = '46px "Cinzel", serif'
  ctx.fillText(WEDDING.dateLabel, W / 2, 490)

  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { width: 760, margin: 2, errorCorrectionLevel: 'H', color: { dark: DARK, light: LIGHT } })
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(W / 2 - 400, 560, 800, 800)
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.strokeRect(W / 2 - 400, 560, 800, 800)
  ctx.drawImage(qr, W / 2 - 380, 580, 760, 760)

  ctx.fillStyle = '#45341f'
  ctx.font = 'italic 54px "Cormorant Garamond", serif'
  ctx.fillText('Skenirajte i podijelite s nama', W / 2, 1460)
  ctx.fillText('svoje fotografije i videozapise', W / 2, 1525)
  ctx.fillStyle = '#8a672b'
  ctx.font = '30px "Cinzel", serif'
  ctx.fillText(WEDDING.venue.toUpperCase(), W / 2, 1620)
  return c.toDataURL('image/png')
}

export default function QrPanel() {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [url, setUrl] = useState(`${PUBLIC_SITE_URL || origin}/`)
  const [svg, setSvg] = useState('')
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef(null)
  const looksTemporary = /localhost|127\.0\.0\.1|deploy-preview|--/.test(url)

  useEffect(() => {
    if (!url) return
    QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'H', color: { dark: DARK, light: LIGHT } })
      .then(setSvg)
      .catch(() => setSvg(''))
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 280, margin: 2, errorCorrectionLevel: 'H', color: { dark: DARK, light: LIGHT } }).catch(() => {})
    }
  }, [url])

  return (
    <section className="panel qr-panel">
      <h3>QR kod za goste</h3>
      <p className="muted">
        QR kod vodi na javnu adresu stranice. Provjerite da je adresa ispod <strong>konačna</strong> (nakon promjene imena stranice
        ili povezivanja vlastite domene na Netlifyju), pa tek onda štampajte.
      </p>
      <label className="field">
        <span className="field-label">Adresa stranice</span>
        <input type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
      </label>
      {looksTemporary && <p className="notice notice-error">Ovo izgleda kao privremena/lokalna adresa – QR za štampu napravite sa konačne javne adrese.</p>}
      <div className="qr-preview">
        <canvas ref={canvasRef} width={280} height={280} aria-label={`QR kod za ${url}`} data-testid="qr-canvas" />
        <p className="qr-url">{url}</p>
      </div>
      <div className="actions">
        <button
          className="btn btn-gold"
          disabled={busy || !url}
          onClick={async () => {
            setBusy(true)
            save(await renderCard(url), 'Sejla-Edvin-QR-kartica.png')
            setBusy(false)
          }}
        >
          <IconDownload width={18} height={18} /> Kartica za štampu (PNG)
        </button>
        <button
          className="btn btn-ghost"
          disabled={!url}
          onClick={async () => save(await QRCode.toDataURL(url, { width: 2000, margin: 2, errorCorrectionLevel: 'H', color: { dark: DARK, light: LIGHT } }), 'Sejla-Edvin-QR.png')}
        >
          QR (PNG 2000 px)
        </button>
        <button
          className="btn btn-ghost"
          disabled={!svg}
          onClick={() => save(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, 'Sejla-Edvin-QR.svg')}
        >
          QR (SVG)
        </button>
      </div>
    </section>
  )
}
