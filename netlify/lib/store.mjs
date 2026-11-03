import { createHash, randomUUID } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { HttpError } from './http.mjs'

// VERZIJA C – svi odgovori s ove pozivnice pripadaju grupi KOD MLADOŽENJE.
// Grupu određuje server (gost je ne može promijeniti).
export const GUEST_GROUP = 'KOD MLADOŽENJE'

// Netlify Blobs: trajna pohrana ugrađena u Netlify (bez vanjske baze i bez ključeva u kodu).
// Zasebno ime spremišta – ne miješa se s ranijim pozivnicama.
// Svaka potvrda je zaseban zapis, pa istovremena slanja ne mogu pregaziti jedno drugo.
export const rsvpStore = () => getStore({ name: 'rsvp-mladozenja', consistency: 'strong' })
export const securityStore = () => getStore({ name: 'rsvp-mladozenja-security', consistency: 'strong' })

export const MAX_GUESTS = 20

export const hashIp = (ip) => createHash('sha256').update(`ip:${ip || 'unknown'}`).digest('hex').slice(0, 32)

const clean = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

// Provjera podataka – ista za slanje gosta i izmjenu u adminu.
export function validateRsvp(body) {
  const name = clean(body.name, 80)
  if (name.length < 3 || !/\s/.test(name)) throw new HttpError(400, 'Molimo upišite ime i prezime.')
  if (typeof body.attending !== 'boolean') throw new HttpError(400, 'Molimo odaberite: Dolazim ili Ne mogu doći.')
  const attending = body.attending
  let guests = 0
  if (attending) {
    guests = Number(body.guests)
    if (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) {
      throw new HttpError(400, `Broj osoba mora biti između 1 i ${MAX_GUESTS}.`)
    }
  }
  const note = String(body.note ?? '').replace(/\r/g, '').trim().slice(0, 500)
  return { name, attending, guests, note }
}

export const newId = () => `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`

export async function listRsvps(store) {
  const { blobs } = await store.list()
  const out = []
  for (let i = 0; i < blobs.length; i += 25) {
    const chunk = await Promise.all(blobs.slice(i, i + 25).map((b) => store.get(b.key, { type: 'json' })))
    out.push(...chunk.filter(Boolean))
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
