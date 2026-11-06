import QRCode from 'qrcode'
import { WEDDING } from '../lib/config.js'

export const QR_DARK = '#2f2210'
export const QR_LIGHT = '#ffffff'
export const qrOptions = { margin: 2, errorCorrectionLevel: 'H', color: { dark: QR_DARK, light: QR_LIGHT } }

// Elegantna kartica za štampu: A6 (105 × 148 mm) na 300 dpi = 1240 × 1748 px
export async function renderCard(url, tableLabel) {
  await Promise.all([
    document.fonts.load('150px "Great Vibes"'),
    document.fonts.load('40px "Cinzel"'),
    document.fonts.load('600 58px "Cinzel"'),
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
  bg.addColorStop(1, '#f6ecdc')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, 900)
  glow.addColorStop(0, 'rgba(253, 226, 170, 0.55)')
  glow.addColorStop(1, 'rgba(253, 226, 170, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const gold = ctx.createLinearGradient(0, 0, W, H)
  gold.addColorStop(0, '#e2c88e')
  gold.addColorStop(0.5, '#b8924a')
  gold.addColorStop(1, '#8a672b')
  ctx.strokeStyle = gold
  ctx.lineWidth = 6
  ctx.strokeRect(46, 46, W - 92, H - 92)
  ctx.lineWidth = 2
  ctx.strokeRect(70, 70, W - 140, H - 140)
  // uglovi
  for (const [x, y] of [[70, 70], [W - 70, 70], [70, H - 70], [W - 70, H - 70]]) {
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fillStyle = gold
    ctx.fill()
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a672b'
  ctx.font = '36px "Cinzel", serif'
  ctx.fillText('W E D D I N G   M E M O R I E S', W / 2, 200)
  ctx.fillStyle = gold
  ctx.font = '150px "Great Vibes", cursive'
  ctx.fillText(`${WEDDING.bride} & ${WEDDING.groom}`, W / 2, 375)
  ctx.fillStyle = '#45341f'
  ctx.font = '44px "Cinzel", serif'
  ctx.fillText(WEDDING.dateLabel, W / 2, 455)

  const top = tableLabel ? 600 : 540
  if (tableLabel) {
    ctx.fillStyle = '#8a672b'
    ctx.font = '600 58px "Cinzel", serif'
    ctx.fillText(tableLabel.toUpperCase(), W / 2, 555)
  }
  const size = 720
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { ...qrOptions, width: size })
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(W / 2 - size / 2 - 20, top, size + 40, size + 40)
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.strokeRect(W / 2 - size / 2 - 20, top, size + 40, size + 40)
  ctx.drawImage(qr, W / 2 - size / 2, top + 20, size, size)

  const textTop = top + size + 130
  ctx.fillStyle = '#45341f'
  ctx.font = 'italic 52px "Cormorant Garamond", serif'
  ctx.fillText('Skenirajte i podijelite s nama', W / 2, textTop)
  ctx.fillText('svoje fotografije i videozapise', W / 2, textTop + 64)
  ctx.fillStyle = '#8a672b'
  ctx.font = '28px "Cinzel", serif'
  ctx.fillText(WEDDING.venue.toUpperCase(), W / 2, Math.min(H - 120, textTop + 160))
  return c
}

export const canvasToBlob = (c) => new Promise((r) => c.toBlob(r, 'image/png'))

export function saveHref(href, name) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
}
