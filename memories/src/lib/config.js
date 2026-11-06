// Javna konfiguracija (smije biti u pregledniku). Vrijednosti dolaze iz
// varijabli okruženja na Netlifyju – vidi .env.example i README.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '')
export const IS_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY)

export const WEDDING = {
  bride: 'Šejla',
  groom: 'Edvin',
  dateLabel: '23.01.2027.',
  dateLong: 'subota, 23. januar 2027.',
  venue: 'ADS Caffe & Restaurant',
}

// Ista ograničenja provjerava i server (netlify/lib/core.mjs) – ovdje služe za brzu poruku gostu.
export const DEFAULT_LIMITS = { maxImageMB: 25, maxVideoMB: 50, maxFilesPerBatch: 20 }

export const publicUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/gallery/${path}`
