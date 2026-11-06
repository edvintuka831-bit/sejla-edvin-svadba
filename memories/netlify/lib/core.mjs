// Zajednički kod svih serverskih funkcija (Netlify Functions).
// Secret ključ Supabasea postoji SAMO ovdje, u varijablama okruženja Netlifyja –
// nikad u kodu koji se šalje u preglednik.
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = (name, fallback) => {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}
const intEnv = (name, fallback) => {
  const n = Number.parseInt(env(name, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const MB = 1024 * 1024

export const settings = {
  supabaseUrl: env('SUPABASE_URL', env('VITE_SUPABASE_URL', '')).replace(/\/$/, ''),
  secretKey: env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY', '')),
  rateSecret: env('RATE_LIMIT_SECRET', ''),
  // Ograničenja (mogu se promijeniti varijablama okruženja na Netlifyju)
  maxImageBytes: intEnv('MAX_IMAGE_MB', 25) * MB,
  // Supabase Free plan dozvoljava najviše 50 MB po datoteci.
  maxVideoBytes: Math.min(intEnv('MAX_VIDEO_MB', 50), 50) * MB,
  maxFilesPerBatch: intEnv('MAX_FILES_PER_BATCH', 20),
  maxFilesPerHour: intEnv('MAX_FILES_PER_HOUR', 80),
  maxFilesPerDay: intEnv('MAX_FILES_PER_DAY', 250),
  maxFilesGlobalPerDay: intEnv('MAX_FILES_GLOBAL_PER_DAY', 4000),
  maxWishesPerHour: intEnv('MAX_WISHES_PER_HOUR', 8),
  // Ukupni prostor: Free plan = 1 GB. Na Pro planu povećajte (npr. 95000).
  storageLimitBytes: intEnv('STORAGE_LIMIT_MB', 950) * MB,
}

export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}
export const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
}
// Formati koje preglednik sigurno prikazuje bez konverzije
export const WEB_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const PREVIEW_MAX_BYTES = 6 * MB
export const THUMB_MAX_BYTES = 2 * MB

let cachedClient
export function adminClient() {
  if (!settings.supabaseUrl || !settings.secretKey) {
    throw new HttpError(503, 'Server nije podešen (nedostaju SUPABASE_URL / SUPABASE_SECRET_KEY).')
  }
  cachedClient ??= createClient(settings.supabaseUrl, settings.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return cachedClient
}

// ---------------------------------------------------------------- HTTP

const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: baseHeaders })

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export async function readJson(req, maxBytes = 20_000) {
  const text = await req.text()
  if (text.length > maxBytes) throw new HttpError(413, 'Zahtjev je prevelik.')
  try {
    const data = JSON.parse(text || '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    return data
  } catch {
    throw new HttpError(400, 'Neispravan zahtjev.')
  }
}

export const handle = (fn) => async (req, context) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Metoda nije dozvoljena.')
    // Zaštita od slanja sa tuđih stranica (CSRF): zahtjev mora biti JSON
    if (!(req.headers.get('content-type') || '').includes('application/json')) {
      throw new HttpError(415, 'Neispravan format zahtjeva.')
    }
    return await fn(req, context)
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status)
    console.error(err)
    return json({ error: 'Došlo je do greške na serveru. Pokušajte ponovo.' }, 500)
  }
}

// ---------------------------------------------------------------- Gosti

// IP adresa se nikad ne sprema – samo njen HMAC-sažetak, za ograničenje slanja.
export function clientHash(req, context) {
  const ip =
    context?.ip ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  const secret = settings.rateSecret || settings.secretKey
  return createHash('sha256').update(`${secret}|${ip}`).digest('hex').slice(0, 40)
}

export async function consumeRate(hash, action, units, limit, window) {
  const { data, error } = await adminClient().rpc('consume_rate', {
    p_client_hash: hash,
    p_action: action,
    p_units: units,
    p_limit: limit,
    p_window: window,
  })
  if (error) throw error
  return data === true
}

export function cleanName(value) {
  const name = String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return name
}

export function cleanText(value, max) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

export const randomKey = () => randomBytes(24).toString('base64url')
export const sha256 = (s) => createHash('sha256').update(s).digest('hex')

// ---------------------------------------------------------------- Provjera sadržaja

// Provjera "magičnih bajtova" – datoteka mora zaista biti slika/video,
// bez obzira na ime i tip koji je preglednik prijavio.
export function detectType(bytes) {
  const b = bytes
  const ascii = (start, end) => String.fromCharCode(...b.subarray(start, end))
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'
  if (b.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12).toLowerCase()
    if (['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx'].includes(brand)) return 'image/heic'
    if (['mif1', 'msf1', 'avif'].includes(brand)) return 'image/heif'
    if (brand === 'qt  ') return 'video/quicktime'
    if (brand.startsWith('3g')) return 'video/3gpp'
    return 'video/mp4' // isom, mp41, mp42, avc1, iso5, dash, M4V ...
  }
  return null
}

const FAMILY = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heif',
  'image/heif': 'heif',
  'video/mp4': 'isobmff',
  'video/quicktime': 'isobmff',
  'video/3gpp': 'isobmff',
  'video/webm': 'webm',
}

export function typeMatches(declared, detected) {
  if (!detected) return false
  return FAMILY[declared] === FAMILY[detected]
}

// Pročitaj prvih N bajtova privatne datoteke (preko kratkotrajnog potpisanog linka)
export async function readHead(bucket, path, length = 64) {
  const { data, error } = await adminClient().storage.from(bucket).createSignedUrl(path, 60)
  if (error) throw error
  const res = await fetch(data.signedUrl, { headers: { range: `bytes=0-${length - 1}` } })
  if (!res.ok) throw new Error(`Čitanje datoteke nije uspjelo (${res.status}).`)
  const buf = new Uint8Array(await res.arrayBuffer())
  return buf.subarray(0, length)
}
