// Zajednički kod serverskih funkcija (Netlify Functions).
// Tajni podaci (R2 ključevi, šifre administratora) postoje SAMO u varijablama
// okruženja na Netlifyju – nikad u kodu koji se šalje u preglednik.
import { createHash, createHmac, randomBytes } from 'node:crypto'

export const env = (name, fallback = '') => {
  let value
  try {
    value = globalThis.Netlify?.env?.get(name)
  } catch {
    /* stariji runtime */
  }
  value ??= process.env[name]
  return value === undefined || value === null || value === '' ? fallback : String(value).trim()
}
const intEnv = (name, fallback) => {
  const n = Number.parseInt(env(name), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const MB = 1024 * 1024
const GB = 1024 * MB

export const settings = {
  maxImageBytes: intEnv('MAX_IMAGE_MB', 30) * MB,
  maxVideoBytes: intEnv('MAX_VIDEO_MB', 200) * MB,
  maxFilesPerBatch: intEnv('MAX_FILES_PER_BATCH', 20),
  maxFilesPerHour: intEnv('MAX_FILES_PER_HOUR', 80),
  maxFilesPerDay: intEnv('MAX_FILES_PER_DAY', 250),
  maxBytesPerDay: intEnv('MAX_GB_PER_DAY_PER_GUEST', 3) * GB,
  maxFilesGlobalPerDay: intEnv('MAX_FILES_GLOBAL_PER_DAY', 5000),
  maxWishesPerHour: intEnv('MAX_WISHES_PER_HOUR', 8),
  // Cloudflare R2: prvih 10 GB je besplatno. Zadano 9 GB = bez ikakvog troška.
  storageLimitBytes: intEnv('STORAGE_LIMIT_GB', 9) * GB,
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
export const PREVIEW_MAX_BYTES = 8 * MB
export const THUMB_MAX_BYTES = 2 * MB

// ---------------------------------------------------------------- HTTP

const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...headers } })

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export async function readJson(req, maxBytes = 40_000) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) {
    throw new HttpError(415, 'Neispravan format zahtjeva.')
  }
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

export const handle = (fn, methods = ['POST']) => async (req, context) => {
  try {
    if (!methods.includes(req.method)) throw new HttpError(405, 'Metoda nije dozvoljena.')
    return await fn(req, context)
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status)
    console.error(err)
    return json({ error: 'Došlo je do greške na serveru. Pokušajte ponovo.' }, 500)
  }
}

// ---------------------------------------------------------------- Gosti

// IP adresa se nikad ne sprema – samo njen HMAC-sažetak (ograničenje slanja, zaštita prijave).
export function clientHash(req, context) {
  const ip =
    context?.ip ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  const secret = env('SESSION_SECRET', 'lokalno')
  return createHmac('sha256', secret).update(`ip|${ip}`).digest('hex').slice(0, 32)
}

export function cleanName(value, max = 60) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
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

// Vremenski sortirani ID (najnovije zadnje), nepredvidiv
export const newId = () => `${Date.now().toString(36).padStart(9, '0')}-${randomBytes(9).toString('base64url')}`
export const idTime = (id) => Number.parseInt(String(id).split('-')[0], 36) || 0
export const ID_RE = /^[0-9a-z]{9}-[A-Za-z0-9_-]{12}$/
export const randomKey = () => randomBytes(24).toString('base64url')
export const sha256 = (s) => createHash('sha256').update(s).digest('hex')

// ---------------------------------------------------------------- Provjera sadržaja

// "Magični bajtovi": datoteka mora zaista biti slika/video, bez obzira na ime i prijavljeni tip.
export function detectType(b) {
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
    return 'video/mp4'
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
export const typeMatches = (declared, detected) => Boolean(detected) && FAMILY[declared] === FAMILY[detected]
