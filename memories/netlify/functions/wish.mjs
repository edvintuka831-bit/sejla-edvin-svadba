// POST /api/wish – gost šalje čestitku (čeka odobrenje administratora)
import {
  HttpError,
  adminClient,
  cleanName,
  cleanText,
  clientHash,
  consumeRate,
  handle,
  json,
  readJson,
  settings,
} from '../lib/core.mjs'

export default handle(async (req, context) => {
  const body = await readJson(req, 8_000)
  if (body.website) throw new HttpError(400, 'Zahtjev je odbijen.')
  if (body.consent !== true) {
    throw new HttpError(400, 'Potrebna je Vaša saglasnost za objavu čestitke.')
  }
  const guestName = cleanName(body.guestName)
  const message = cleanText(body.message, 1000)
  if (guestName.length < 2) throw new HttpError(400, 'Upišite Vaše ime.')
  if (message.length < 2) throw new HttpError(400, 'Napišite čestitku.')
  if (/https?:\/\/|www\./i.test(message)) {
    throw new HttpError(400, 'Čestitka ne smije sadržavati linkove.')
  }

  const hash = clientHash(req, context)
  if (!(await consumeRate(hash, 'wish-hour', 1, settings.maxWishesPerHour, '1 hour'))) {
    throw new HttpError(429, 'Poslali ste više čestitki u kratkom roku. Pokušajte ponovo kasnije.')
  }

  const { data, error } = await adminClient()
    .from('wishes')
    .insert({ guest_name: guestName, message, consent_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return json({ ok: true, id: data.id })
})

export const config = { path: '/api/wish' }
