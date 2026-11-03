import { fail, handle, json, readJson } from '../lib/http.mjs'
import { GUEST_GROUP, hashIp, newId, rsvpStore, securityStore, validateRsvp } from '../lib/store.mjs'

// Mobilni operateri često dijele istu IP adresu među mnogo korisnika, pa je granica velikodušna.
const MAX_PER_HOUR = 60

// POST /api/rsvp – gost šalje potvrdu dolaska.
// Uspjeh (201) se vraća tek nakon što je zapis upisan I ponovo pročitan iz baze.
export default handle(async (req, context) => {
  if (req.method !== 'POST') return fail(405, 'Metoda nije dozvoljena.')
  const body = await readJson(req)

  // Skriveno polje koje popunjavaju samo spam-botovi.
  if (body.website) return fail(400, 'Neispravan zahtjev.')

  const data = validateRsvp(body)

  const security = securityStore()
  const hourKey = `submit/${hashIp(context?.ip)}/${new Date().toISOString().slice(0, 13)}`
  const count = (await security.get(hourKey, { type: 'json' })) || 0
  if (count >= MAX_PER_HOUR) return fail(429, 'Previše pokušaja. Molimo pokušajte ponovo za sat vremena.')
  await security.setJSON(hourKey, count + 1)

  const now = new Date().toISOString()
  const record = { id: newId(), group: GUEST_GROUP, ...data, createdAt: now, updatedAt: now }
  const store = rsvpStore()
  await store.setJSON(record.id, record)

  // Potvrda upisa: čitamo zapis nazad (strong consistency) prije nego javimo gostu da je spremljeno.
  const check = await store.get(record.id, { type: 'json' })
  if (!check || check.id !== record.id) return fail(500, 'Potvrda nije spremljena. Molimo pokušajte ponovo.')

  return json({ ok: true, id: record.id, group: record.group }, 201)
})

export const config = { path: '/api/rsvp' }
