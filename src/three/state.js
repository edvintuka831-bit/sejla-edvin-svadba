// Dijeljeno stanje između HTML sadržaja i 3D scene (bez React re-rendera po frejmu).
export const sceneState = {
  progress: 0, // 0..1 – koliko je gost skrolao kroz pozivnicu
  opened: false, // koverta otvorena
  openedAt: 0, // performance.now() u trenutku otvaranja
}

export function detectTier() {
  if (typeof window === 'undefined') return 'mid'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  const mem = navigator.deviceMemory || 8
  const cores = navigator.hardwareConcurrency || 8
  if ((coarse || small) && (mem <= 3 || cores <= 4)) return 'low'
  if (coarse || small) return 'mid'
  return 'high'
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
