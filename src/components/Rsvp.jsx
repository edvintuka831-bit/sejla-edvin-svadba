import { useRef, useState } from 'react'
import { DATE_TEXT } from '../config.js'
import Icon from './Icons.jsx'
import { Divider } from './Ornaments.jsx'

const MAX_GUESTS = 20
const SAVED_KEY = 'rsvp-mladozenja'

const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || 'null')
  } catch {
    return null
  }
}
const writeSaved = (v) => {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(v))
  } catch {
    // privatni način rada – potvrda je svejedno u bazi
  }
}

// Potvrda dolaska – upis u bazu (Netlify Blobs) preko /api/rsvp.
// "Hvala" se prikazuje ISKLJUČIVO kada server potvrdi upis (HTTP 201 + id zapisa).
export default function Rsvp() {
  const [saved, setSaved] = useState(readSaved)
  const [name, setName] = useState('')
  const [attending, setAttending] = useState(null)
  const [guests, setGuests] = useState(1)
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('') // skriveno polje protiv spam-botova
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(saved ? 'done' : 'idle') // idle | sending | done | error
  const [serverError, setServerError] = useState('')
  const formRef = useRef(null)

  const validate = () => {
    const next = {}
    const n = name.trim().replace(/\s+/g, ' ')
    if (n.length < 3 || !n.includes(' ')) next.name = 'Molimo upišite ime i prezime.'
    if (attending === null) next.attending = 'Molimo odaberite: Dolazim ili Ne mogu doći.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) formRef.current?.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return !first
  }

  const submit = async (e) => {
    e.preventDefault()
    if (status === 'sending' || !validate()) return
    setStatus('sending')
    setServerError('')
    const payload = { name: name.trim(), attending, guests: attending ? guests : 0, note: note.trim(), website }
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 15000)
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const type = res.headers.get('content-type') || ''
      const data = type.includes('application/json') ? await res.json().catch(() => ({})) : {}
      if (res.status !== 201 || !data.ok || !data.id) {
        throw new Error(
          data.error ||
            (res.status === 404
              ? 'Server za potvrde trenutno nije dostupan.'
              : 'Potvrda nije spremljena.'),
        )
      }
      const record = { id: data.id, name: payload.name, attending, guests: payload.guests, at: new Date().toISOString() }
      writeSaved(record)
      setSaved(record)
      setStatus('done')
      setName('')
      setAttending(null)
      setGuests(1)
      setNote('')
      setErrors({})
    } catch (err) {
      const offline = err.name === 'AbortError' || err.message === 'Failed to fetch' || err instanceof TypeError
      setServerError(offline ? 'Nema veze sa serverom. Provjerite internet i pokušajte ponovo.' : err.message)
      setStatus('error')
    }
  }

  return (
    <div className="card rsvp-card" id="potvrda">
      <p className="eyebrow">Potvrda dolaska</p>
      <h2 className="section-title">Hoćete li biti s nama?</h2>
      <p className="rsvp-deadline">
        Molimo Vas da dolazak potvrdite najkasnije do <strong>{DATE_TEXT.rsvpDeadline}</strong>
      </p>
      <Divider />

      {status === 'done' && saved ? (
        <div className="thanks" role="status">
          <div className="thanks-icon"><Icon name="heart" size={30} /></div>
          <p className="thanks-title">Hvala, {saved.name}!</p>
          {saved.attending ? (
            <p>Vaša potvrda je spremljena (broj osoba: {saved.guests}). Vidimo se u 12:00 kod mladoženje Edvina, pa zajedno idemo po mladu!</p>
          ) : (
            <p>Žao nam je što nećete moći doći. Hvala što ste nam javili – bit ćete u našim mislima.</p>
          )}
          <p className="thanks-sign">S ljubavlju, Šejla &amp; Edvin</p>
          <button type="button" className="btn btn-outline" onClick={() => setStatus('idle')}>
            Pošalji potvrdu za drugu osobu
          </button>
        </div>
      ) : (
        <form className="form" ref={formRef} onSubmit={submit} noValidate>
          <label className="field" data-field="name">
            <span className="field-label">Ime i prezime</span>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((er) => ({ ...er, name: undefined }))
              }}
              autoComplete="name"
              placeholder="npr. Amar Hodžić"
              aria-invalid={!!errors.name}
              maxLength={80}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>

          <fieldset className="field" data-field="attending">
            <legend className="field-label">Dolazak</legend>
            <div className="choice-row">
              <button type="button" className={`choice ${attending === true ? 'is-active' : ''}`} aria-pressed={attending === true}
                onClick={() => { setAttending(true); setErrors((er) => ({ ...er, attending: undefined })) }}>
                Dolazim
              </button>
              <button type="button" className={`choice ${attending === false ? 'is-active' : ''}`} aria-pressed={attending === false}
                onClick={() => { setAttending(false); setErrors((er) => ({ ...er, attending: undefined })) }}>
                Ne mogu doći
              </button>
            </div>
            {errors.attending && <span className="field-error">{errors.attending}</span>}
          </fieldset>

          {attending !== false && (
            <fieldset className="field">
              <legend className="field-label">Broj osoba</legend>
              <div className="stepper" role="group" aria-label="Broj osoba">
                <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} disabled={guests <= 1} aria-label="Smanji broj osoba">
                  <Icon name="minus" size={20} />
                </button>
                <output aria-live="polite">{guests}</output>
                <button type="button" onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))} disabled={guests >= MAX_GUESTS} aria-label="Povećaj broj osoba">
                  <Icon name="plus" size={20} />
                </button>
              </div>
            </fieldset>
          )}

          <label className="field">
            <span className="field-label">Napomena <small>(opcionalno)</small></span>
            <textarea name="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder="Čestitke, želje ili napomena..." />
          </label>

          <label className="hp" aria-hidden="true">
            Web stranica
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>

          {status === 'error' && (
            <div className="form-alert" role="alert">
              <b>Potvrda NIJE spremljena.</b> {serverError} Molimo pokušajte ponovo.
            </div>
          )}

          <button type="submit" className="btn btn-gold btn-lg" disabled={status === 'sending'}>
            {status === 'sending' ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={20} />}
            {status === 'sending' ? 'Spremam potvrdu...' : 'Potvrdi dolazak'}
          </button>
        </form>
      )}
    </div>
  )
}
