// Prijava administratora: SAMO dva računa – Šejla i Edvin.
// Šifre se postavljaju privatno na Netlifyju (ADMIN_SEJLA_PASSWORD, ADMIN_EDVIN_PASSWORD).
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpError, env } from './core.mjs'
import { addEvent, clearEvents, countEvents } from './db.mjs'

export const ADMINS = {
  sejla: { name: 'Šejla', envVar: 'ADMIN_SEJLA_PASSWORD' },
  edvin: { name: 'Edvin', envVar: 'ADMIN_EDVIN_PASSWORD' },
}
const COOKIE = 'uspomene_admin'
const SESSION_HOURS = 24 * 7
const MIN_PASSWORD = 12
const MAX_FAILS = 5
const LOCK_MINUTES = 15

const password = (id) => env(ADMINS[id]?.envVar || '__nema__')
const sessionSecret = () => env('SESSION_SECRET')

export function configStatus() {
  return {
    sejla: password('sejla').length >= MIN_PASSWORD,
    edvin: password('edvin').length >= MIN_PASSWORD,
    session: sessionSecret().length >= 32,
  }
}

function assertConfigured(id) {
  if (sessionSecret().length < 32) {
    throw new HttpError(503, 'Varijabla SESSION_SECRET nije postavljena ili je kraća od 32 znaka.')
  }
  const pw = password(id)
  if (pw.length < MIN_PASSWORD) {
    throw new HttpError(503, `Šifra za ${ADMINS[id].name} nije postavljena ili je kraća od ${MIN_PASSWORD} znakova (${ADMINS[id].envVar}).`)
  }
}

// Ključ potpisa uključuje šifru: promjena šifre odjavljuje sve uređaje tog administratora.
const key = (id) => createHash('sha256').update(`${sessionSecret()}|${id}|${password(id)}`).digest()
const mac = (id, payload) => createHmac('sha256', key(id)).update(payload).digest('base64url')
const same = (a, b) =>
  timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest())

function readCookie(req) {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return v.join('=')
  }
  return ''
}

const secureFlag = (req) => (new URL(req.url).protocol === 'https:' ? '; Secure' : '')

export async function login(req, id, pw, clientHash) {
  if (!ADMINS[id]) throw new HttpError(400, 'Izaberite Šejla ili Edvin.')
  assertConfigured(id)
  // pogrešni pokušaji u tekućem 15-minutnom prozoru (svaki pokušaj je zaseban zapis)
  const windowMs = LOCK_MINUTES * 60000
  const bucket = Math.floor(Date.now() / windowMs)
  const prefix = `sec/login/${id}/${clientHash}/${bucket}/`
  if ((await countEvents(prefix)) >= MAX_FAILS) {
    const min = Math.ceil(((bucket + 1) * windowMs - Date.now()) / 60000)
    throw new HttpError(429, `Previše pogrešnih pokušaja. Pokušajte ponovo za ${min} min.`)
  }
  if (!same(pw, password(id))) {
    await addEvent(prefix)
    throw new HttpError(401, 'Pogrešna šifra.')
  }
  await clearEvents(prefix)
  const exp = Date.now() + SESSION_HOURS * 3600_000
  const payload = `${id}.${exp}.${randomBytes(12).toString('base64url')}`
  const token = `${payload}.${mac(id, payload)}`
  return `${COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secureFlag(req)}`
}

export const logoutCookie = (req) => `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag(req)}`

export function currentAdmin(req) {
  const parts = readCookie(req).split('.')
  if (parts.length !== 4) return null
  const [id, exp, nonce, sig] = parts
  if (!ADMINS[id] || password(id).length < MIN_PASSWORD || sessionSecret().length < 32) return null
  if (!same(sig, mac(id, `${id}.${exp}.${nonce}`))) return null
  if (Number(exp) < Date.now()) return null
  return { id, name: ADMINS[id].name }
}

export function requireAdmin(req) {
  const admin = currentAdmin(req)
  if (!admin) throw new HttpError(401, 'Prijava je istekla. Prijavite se ponovo.')
  // Zaštita od lažnih zahtjeva s drugih stranica (uz SameSite=Strict kolačić)
  if (req.method !== 'GET' && req.headers.get('x-admin-request') !== '1') {
    throw new HttpError(403, 'Zahtjev nije dozvoljen.')
  }
  return admin
}
