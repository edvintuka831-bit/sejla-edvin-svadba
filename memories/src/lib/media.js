// Obrada u pregledniku gosta, PRIJE slanja:
//  - pregled (do 2048 px) i sličica (do 640 px) za galeriju – nove JPEG datoteke
//    BEZ EXIF/GPS podataka, pa javna galerija ne otkriva lokaciju ni uređaj
//  - naslovna sličica (poster) i trajanje videozapisa
// Original se šalje netaknut u privatni prostor (za mladence).

const EXT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp',
}
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp']

// Neki telefoni ne prijave tip (npr. HEIC na Androidu) – tada se gleda nastavak imena.
export function normalizeType(file) {
  let type = (file.type || '').toLowerCase()
  if (type === 'image/jpg' || type === 'image/pjpeg') type = 'image/jpeg'
  if (type === 'video/x-m4v') type = 'video/mp4'
  if (!IMAGE_TYPES.includes(type) && !VIDEO_TYPES.includes(type)) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    type = EXT_TYPES[ext] || type
  }
  return type
}

export const kindOf = (type) =>
  IMAGE_TYPES.includes(type) ? 'image' : VIDEO_TYPES.includes(type) ? 'video' : null

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() }
    } catch {
      /* pokušaj preko <img> */
    }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  try {
    await img.decode()
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
}

function toJpeg(source, srcW, srcH, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = canvas.height = 0 // oslobodi memoriju (iOS)
        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

export async function prepareImage(file) {
  let decoded
  try {
    decoded = await decodeImage(file)
  } catch {
    return { preview: null, thumb: null, width: null, height: null }
  }
  try {
    const { source, width, height } = decoded
    const preview = await toJpeg(source, width, height, 2048, 0.84)
    const thumb = await toJpeg(source, width, height, 640, 0.78)
    return { preview, thumb, width, height }
  } catch {
    return { preview: null, thumb: null, width: decoded.width, height: decoded.height }
  } finally {
    decoded.release()
  }
}

export function prepareVideo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish({ thumb: null, duration: video.duration || null }), 12000)
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onerror = () => finish({ thumb: null, duration: null })
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = Math.min(1, d > 0 ? d / 3 : 0.1)
    }
    video.onseeked = async () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) return finish({ thumb: null, duration: video.duration || null })
        const thumb = await toJpeg(video, w, h, 960, 0.8)
        finish({ thumb, duration: video.duration || null, width: w, height: h })
      } catch {
        finish({ thumb: null, duration: video.duration || null })
      }
    }
    video.src = url
    video.load()
  })
}
