import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpError } from './http.mjs'

// Šifra se postavlja isključivo u Netlify: Site configuration → Environment variables → ADMIN_PASSWORD.
// Nikada nije u HTML-u ni JavaScriptu stranice.
const COOKIE = 'admin_session'
const SESSION_DAYS = 7

// Netlify.env (novi runtime) ili process.env; razmaci s početka i kraja se zanemaruju.
const readEnv = (name) => {
  try {
    const v = globalThis.Netlify?.env?.get(name)
    if (v) return v
  } catch {
    // stariji runtime nema Netlify.env
  }
  return process.env[name] || ''
}

const password = () => readEnv('ADMIN_PASSWORD').trim()

// Ključ za potpis sesije izveden iz šifre: promjena šifre automatski odjavljuje sve uređaje.
const sessionKey = () =>
  createHash('sha256').update(`sejla-edvin-mladozenja-admin:${process.env.ADMIN_SESSION_SECRET || ''}:${password()}`).digest()

const sign = (payload) => createHmac('sha256', sessionKey()).update(payload).digest('base64url')

const safeEqual = (a, b) => {
  const ha = createHash('sha256').update(String(a)).digest()
  const hb = createHash('sha256').update(String(b)).digest()
  return timingSafeEqual(ha, hb)
}

// Precizna poruka zašto admin nije dostupan (bez otkrivanja same šifre).
export function assertPasswordConfigured() {
  const pw = password()
  if (pw.length >= 8) return
  if (pw.length > 0) {
    throw new HttpError(503, `Varijabla ADMIN_PASSWORD je pronađena, ali ima samo ${pw.length} znakova. Šifra mora imati najmanje 8 znakova.`)
  }
  const similar = Object.keys(process.env).find((k) => k !== 'ADMIN_PASSWORD' && /admin.?pass|pass.?word|sifra|šifra/i.test(k))
  if (similar) {
    throw new HttpError(503, `Pronađena je varijabla "${similar}", ali naziv mora biti tačno ADMIN_PASSWORD (velika slova, donja crta).`)
  }
  throw new HttpError(
    503,
    'Server ne vidi varijablu ADMIN_PASSWORD. Provjerite naziv, da Scopes uključuje Functions, i da je nakon dodavanja urađen novi deploy.',
  )
}

export const checkPassword = (input) => safeEqual(input, password())

export function createSessionCookie(req) {
  const exp = Date.now() + SESSION_DAYS * 86400_000
  const payload = `${exp}.${randomBytes(12).toString('base64url')}`
  const token = `${payload}.${sign(payload)}`
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
  return `${COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure}`
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`

function readCookie(req, name) {
  const header = req.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return ''
}

export function isAuthenticated(req) {
  if (password().length < 8) return false
  const token = readCookie(req, COOKIE)
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [exp, nonce, mac] = parts
  if (!safeEqual(mac, sign(`${exp}.${nonce}`))) return false
  return Number(exp) > Date.now()
}

export function requireAdmin(req) {
  assertPasswordConfigured()
  if (!isAuthenticated(req)) throw new HttpError(401, 'Prijava je istekla. Prijavite se ponovo.')
  // Dodatna zaštita od lažnih zahtjeva s drugih stranica.
  if (req.method !== 'GET' && req.headers.get('x-admin-request') !== '1') {
    throw new HttpError(403, 'Zahtjev nije dozvoljen.')
  }
}
