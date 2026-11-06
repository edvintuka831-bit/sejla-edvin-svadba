// Javna konfiguracija (smije biti u pregledniku). Nema nikakvih ključeva –
// sve tajno je samo u serverskim funkcijama na Netlifyju.
export const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '')

export const WEDDING = {
  bride: 'Šejla',
  groom: 'Edvin',
  dateLabel: '23.01.2027.',
  dateLong: 'subota, 23. januar 2027.',
  venue: 'ADS Caffe & Restaurant',
}

// Ista ograničenja provjerava i server – ovdje služe samo za brzu poruku gostu.
export const DEFAULT_CONFIG = { maxImageMB: 30, maxVideoMB: 200, maxFilesPerBatch: 20, tables: [] }

export const siteBase = () => PUBLIC_SITE_URL || window.location.origin
export const tableUrl = (id) => `${siteBase()}/?sto=${encodeURIComponent(id)}`

// Pravi QR kodovi se prave SAMO za konačnu javnu adresu (https, bez lokalnih i privremenih
// Netlify adresa). Do tada se prave uzorci kartica bez QR koda.
export function isFinalAddress(base) {
  try {
    const u = new URL(base)
    return u.protocol === 'https:' && !/^(localhost|127\.|\d+\.\d+\.\d+\.\d+$)/.test(u.hostname) && !u.hostname.includes('--')
  } catch {
    return false
  }
}
