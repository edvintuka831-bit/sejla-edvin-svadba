import QRCode from 'qrcode'
import { WEDDING } from '../lib/config.js'

export const QR_DARK = '#2f2210'
export const QR_LIGHT = '#ffffff'
export const qrOptions = { margin: 2, errorCorrectionLevel: 'H', color: { dark: QR_DARK, light: QR_LIGHT } }
export const CARD_TEXT = ['„Skenirajte QR kod i podijelite', 'najljepše uspomene s nama.“']

// Luksuzna kartica u bijelo-zlatnom stilu: A6 (105 × 148 mm) na 300 dpi = 1240 × 1748 px.
// url = null → UZORAK bez QR koda (dok konačna adresa galerije nije poznata).
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

  // bijela podloga s toplim sjajem
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, -100, 60, W / 2, -100, 1100)
  glow.addColorStop(0, 'rgba(250, 232, 190, 0.55)')
  glow.addColorStop(1, 'rgba(250, 232, 190, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const gold = ctx.createLinearGradient(0, 0, W, H)
  gold.addColorStop(0, '#e6cd92')
  gold.addColorStop(0.35, '#c9a55e')
  gold.addColorStop(0.55, '#ecd59d')
  gold.addColorStop(1, '#8a672b')

  // dvostruki zlatni okvir s ukrasnim uglovima
  ctx.strokeStyle = gold
  ctx.lineWidth = 7
  ctx.strokeRect(58, 58, W - 116, H - 116)
  ctx.lineWidth = 2
  ctx.strokeRect(84, 84, W - 168, H - 168)
  ctx.fillStyle = gold
  for (const [x, y, sx, sy] of [[84, 84, 1, 1], [W - 84, 84, -1, 1], [84, H - 84, 1, -1], [W - 84, H - 84, -1, -1]]) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + sx * 70, y)
    ctx.lineTo(x, y + sy * 70)
    ctx.closePath()
    ctx.fill()
  }

  const center = (text, y) => ctx.fillText(text, W / 2, y)
  ctx.textAlign = 'center'

  // Šejla & Edvin
  ctx.fillStyle = gold
  ctx.font = '160px "Great Vibes", cursive'
  center(`${WEDDING.bride} & ${WEDDING.groom}`, 330)

  // ukras: linije i romb
  ctx.strokeStyle = gold
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - 230, 395)
  ctx.lineTo(W / 2 - 40, 395)
  ctx.moveTo(W / 2 + 40, 395)
  ctx.lineTo(W / 2 + 230, 395)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(W / 2, 377)
  ctx.lineTo(W / 2 + 20, 395)
  ctx.lineTo(W / 2, 413)
  ctx.lineTo(W / 2 - 20, 395)
  ctx.closePath()
  ctx.fill()

  // 23.01.2027.
  ctx.fillStyle = '#45341f'
  ctx.font = '50px "Cinzel", serif'
  center(WEDDING.dateLabel.split('').join(' '), 480)

  // QR (ili mjesto za QR na uzorku)
  const size = 640
  const boxX = W / 2 - size / 2 - 24
  const boxY = 545
  const box = size + 48
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(boxX, boxY, box, box)
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.strokeRect(boxX, boxY, box, box)
  if (url) {
    const qr = document.createElement('canvas')
    await QRCode.toCanvas(qr, url, { ...qrOptions, width: size })
    ctx.drawImage(qr, W / 2 - size / 2, boxY + 24, size, size)
  } else {
    ctx.setLineDash([14, 12])
    ctx.strokeStyle = '#c9a55e'
    ctx.strokeRect(boxX + 40, boxY + 40, box - 80, box - 80)
    ctx.setLineDash([])
    ctx.fillStyle = '#8a672b'
    ctx.font = '600 44px "Cinzel", serif'
    center('QR KOD', boxY + box / 2 - 30)
    ctx.font = 'italic 38px "Cormorant Garamond", serif'
    center('dodaje se kada bude poznata', boxY + box / 2 + 30)
    center('konačna adresa galerije', boxY + box / 2 + 76)
  }

  // poruka gostima
  ctx.fillStyle = '#45341f'
  ctx.font = 'italic 56px "Cormorant Garamond", serif'
  center(CARD_TEXT[0], 1380)
  center(CARD_TEXT[1], 1448)

  // STOL [broj]
  if (tableLabel) {
    ctx.fillStyle = gold
    ctx.font = '600 76px "Cinzel", serif'
    center(tableLabel.toUpperCase(), 1580)
  }

  if (!url) {
    ctx.fillStyle = 'rgba(163, 64, 47, 0.75)'
    ctx.font = '600 26px "Cinzel", serif'
    center('UZORAK – NIJE ZA ŠTAMPU', H - 104)
  }
  return c
}

export const canvasToBlob = (c, type = 'image/png') => new Promise((r) => c.toBlob(r, type, 0.95))

export function saveHref(href, name) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
}

// PDF za štampu. layout 'a4': 4 kartice na A4 s oznakama za rezanje (kućni printer);
// layout 'a6': jedna kartica po stranici A6, do ruba (štamparija).
export async function cardsPdf(cards, layout, onProgress) {
  const { jsPDF } = await import('jspdf')
  const a4 = layout === 'a4'
  const doc = new jsPDF({ unit: 'mm', format: a4 ? 'a4' : [105, 148], orientation: 'portrait', compress: true })
  doc.setProperties({ title: `${WEDDING.bride} & ${WEDDING.groom} – QR kartice za stolove`, creator: 'Wedding Memories' })
  const cw = a4 ? 99 : 105
  const ch = a4 ? 140 : 148
  const slots = a4 ? [[6, 8.5], [105, 8.5], [6, 148.5], [105, 148.5]] : [[0, 0]]
  for (let i = 0; i < cards.length; i++) {
    onProgress?.(i + 1, cards.length)
    const slot = i % slots.length
    if (i > 0 && slot === 0) doc.addPage()
    const canvas = await renderCard(cards[i].url, cards[i].label)
    const [x, y] = slots[slot]
    doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, y, cw, ch, undefined, 'FAST')
    if (a4) {
      // oznake za rezanje
      doc.setDrawColor(150)
      doc.setLineWidth(0.15)
      for (const [px, py] of [[x, y], [x + cw, y], [x, y + ch], [x + cw, y + ch]]) {
        doc.line(px - 4, py, px - 1, py)
        doc.line(px + 1, py, px + 4, py)
        doc.line(px, py - 4, px, py - 1)
        doc.line(px, py + 1, px, py + 4)
      }
    }
  }
  return doc.output('blob')
}
