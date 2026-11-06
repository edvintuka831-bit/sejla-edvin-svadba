// POST /api/wish – čestitka mladencima (čeka odobrenje)
import { HttpError, cleanName, cleanText, clientHash, handle, json, newId, readJson, settings } from '../lib/core.mjs'
import { consumeRate, getTables, setStatus } from '../lib/db.mjs'

export default handle(async (req, context) => {
  const body = await readJson(req, 8_000)
  if (body.website) throw new HttpError(400, 'Zahtjev je odbijen.')
  if (body.consent !== true) throw new HttpError(400, 'Potrebna je Vaša saglasnost za objavu čestitke.')
  const guestName = cleanName(body.guestName)
  const message = cleanText(body.message, 1000)
  if (guestName.length < 2) throw new HttpError(400, 'Upišite Vaše ime.')
  if (message.length < 2) throw new HttpError(400, 'Napišite čestitku.')
  if (/https?:\/\/|www\./i.test(message)) throw new HttpError(400, 'Čestitka ne smije sadržavati linkove.')

  if (!(await consumeRate(clientHash(req, context), 'wish-h', 1, settings.maxWishesPerHour, 3600))) {
    throw new HttpError(429, 'Poslali ste više čestitki u kratkom roku. Pokušajte ponovo kasnije.')
  }
  const table = (await getTables()).find((t) => t.id === String(body.table || '')) || null
  const rec = {
    id: newId(),
    guestName,
    message,
    tableLabel: table?.label || null,
    consentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
  await setStatus('wish', rec, 'pending')
  return json({ ok: true })
})

export const config = { path: '/api/wish' }
