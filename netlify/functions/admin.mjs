import {
  assertPasswordConfigured,
  checkPassword,
  clearSessionCookie,
  createSessionCookie,
  isAuthenticated,
  requireAdmin,
} from '../lib/auth.mjs'
import { HttpError, fail, handle, json, readJson } from '../lib/http.mjs'
import { GUEST_GROUP, hashIp, listRsvps, rsvpStore, securityStore, validateRsvp } from '../lib/store.mjs'

const MAX_FAILS = 5
const LOCK_MINUTES = 15
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(req, context) {
  if (req.method !== 'POST') return fail(405, 'Metoda nije dozvoljena.')
  assertPasswordConfigured()

  // Zaštita od pogađanja šifre: nakon 5 pogrešnih pokušaja zaključavanje na 15 minuta.
  const security = securityStore()
  const key = `login/${hashIp(context?.ip)}`
  const state = (await security.get(key, { type: 'json' })) || { fails: 0, until: 0 }
  if (state.until > Date.now()) {
    const min = Math.ceil((state.until - Date.now()) / 60000)
    return fail(429, `Previše pogrešnih pokušaja. Pokušajte ponovo za ${min} min.`)
  }

  const { password } = await readJson(req, 2000)
  if (typeof password !== 'string' || !checkPassword(password)) {
    const fails = state.fails + 1
    await security.setJSON(key, {
      fails: fails >= MAX_FAILS ? 0 : fails,
      until: fails >= MAX_FAILS ? Date.now() + LOCK_MINUTES * 60000 : 0,
    })
    await wait(600)
    return fail(401, 'Pogrešna šifra.')
  }

  await security.delete(key)
  return json({ ok: true }, 200, { 'set-cookie': createSessionCookie(req) })
}

async function rsvps(req, id) {
  requireAdmin(req)
  const store = rsvpStore()

  if (!id) {
    if (req.method !== 'GET') return fail(405, 'Metoda nije dozvoljena.')
    return json({ rsvps: await listRsvps(store) })
  }

  const existing = await store.get(id, { type: 'json' })
  if (!existing) throw new HttpError(404, 'Odgovor nije pronađen.')

  if (req.method === 'PUT') {
    const data = validateRsvp(await readJson(req))
    const updated = { ...existing, ...data, group: existing.group || GUEST_GROUP, updatedAt: new Date().toISOString() }
    await store.setJSON(id, updated)
    return json({ rsvp: updated })
  }
  if (req.method === 'DELETE') {
    await store.delete(id)
    return json({ ok: true })
  }
  return fail(405, 'Metoda nije dozvoljena.')
}

// /api/admin/* – prijava, odjava i upravljanje odgovorima (samo uz važeću sesiju).
export default handle(async (req, context) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '')
  if (path === '/api/admin/login') return login(req, context)
  if (path === '/api/admin/logout') return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() })
  if (path === '/api/admin/session') {
    assertPasswordConfigured()
    return json({ authenticated: isAuthenticated(req) })
  }
  if (path === '/api/admin/rsvps') return rsvps(req, null)
  const m = path.match(/^\/api\/admin\/rsvps\/([A-Za-z0-9-]{4,64})$/)
  if (m) return rsvps(req, m[1])
  return fail(404, 'Nije pronađeno.')
})

export const config = {
  path: ['/api/admin/login', '/api/admin/logout', '/api/admin/session', '/api/admin/rsvps', '/api/admin/rsvps/*'],
}
