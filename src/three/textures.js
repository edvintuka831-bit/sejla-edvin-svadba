import * as THREE from 'three'

const canvas = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

// Kamene ploče za aleju (proceduralno, bez vanjskih slika).
export function pavingTexture(anisotropy = 4) {
  const [c, g] = canvas(512, 512)
  g.fillStyle = '#efe4d2'
  g.fillRect(0, 0, 512, 512)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const rows = 8
  const h = 512 / rows
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 64 : 0
    for (let x = -off; x < 512; x += 128) {
      const t = 228 + rnd() * 16
      g.fillStyle = `rgb(${t + 8},${t - 2},${t - 22})`
      g.fillRect(x + 2, r * h + 2, 124, h - 4)
    }
  }
  g.strokeStyle = 'rgba(160,130,90,0.35)'
  g.lineWidth = 2
  for (let r = 0; r <= rows; r++) {
    g.beginPath()
    g.moveTo(0, r * h)
    g.lineTo(512, r * h)
    g.stroke()
  }
  // središnja zlatna traka
  g.fillStyle = 'rgba(201,165,94,0.55)'
  g.fillRect(250, 0, 12, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}

// Mekani sjaj za lampione i sunce.
export function glowTexture() {
  const [c, g] = canvas(128, 128)
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,240,200,1)')
  grd.addColorStop(0.25, 'rgba(255,215,140,0.55)')
  grd.addColorStop(1, 'rgba(255,200,120,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Latica ruže (alfa maska) za padajuće latice.
export function petalTexture() {
  const [c, g] = canvas(64, 64)
  const grd = g.createRadialGradient(32, 40, 2, 32, 32, 30)
  grd.addColorStop(0, '#ffffff')
  grd.addColorStop(0.7, '#fbeee6')
  grd.addColorStop(1, '#f0d8cc')
  g.fillStyle = grd
  g.beginPath()
  g.moveTo(32, 60)
  g.bezierCurveTo(4, 44, 6, 8, 32, 4)
  g.bezierCurveTo(58, 8, 60, 44, 32, 60)
  g.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
