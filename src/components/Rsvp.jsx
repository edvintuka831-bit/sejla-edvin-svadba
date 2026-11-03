import { useRef, useState } from 'react'
import { CONTACTS, DATE_TEXT } from '../config.js'
import Icon from './Icons.jsx'
import { Divider } from './Ornaments.jsx'

const MAX_GUESTS = 20

// Potvrda dolaska putem WhatsAppa: gost popuni formu, dodirne dugme za Edvina ili Šejlu,
// otvori se WhatsApp s gotovom porukom i gost dodirne "Pošalji".
// (WhatsApp ne dozvoljava web stranici da poruku pošalje sama – slanje uvijek potvrđuje gost.)
function buildMessage({ name, attending, guests, note }) {
  return [
    attending
      ? `Pozdrav, potvrđujem dolazak na vjenčanje Šejle i Edvina ${DATE_TEXT.short} 🤍`
      : `Pozdrav, nažalost ne mogu doći na vjenčanje Šejle i Edvina ${DATE_TEXT.short}.`,
    '',
    `Ime i prezime: ${name}`,
    `Dolazak: ${attending ? 'Dolazim' : 'Ne mogu doći'}`,
    `Broj osoba: ${attending ? guests : 0}`,
    `Napomena: ${note || '-'}`,
  ].join('\n')
}

const waLink = (phone, text) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`

// Rezervna kopija u bazi ako je stranica objavljena preko GitHuba (Netlify funkcije).
// Na stranici objavljenoj prevlačenjem ZIP-a ovo tiho ne uspije – WhatsApp poruka je glavni kanal.
function backupToServer(payload) {
  try {
    fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignoriši
  }
}

export default function Rsvp() {
  const [name, setName] = useState('')
  const [attending, setAttending] = useState(null)
  const [guests, setGuests] = useState(1)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(null) // { to, link, name, attending }
  const formRef = useRef(null)

  const cleanName = name.trim().replace(/\s+/g, ' ')
  const message = buildMessage({ name: cleanName, attending: attending === true, guests, note: note.trim() })

  const validate = () => {
    const next = {}
    if (cleanName.length < 3 || !cleanName.includes(' ')) next.name = 'Molimo upišite ime i prezime.'
    if (attending === null) next.attending = 'Molimo odaberite: Dolazim ili Ne mogu doći.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) formRef.current?.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return !first
  }

  // Link se otvara direktno iz dodira (bez blokiranja na iPhoneu/Androidu).
  const onSend = (contact) => (e) => {
    if (!validate()) {
      e.preventDefault()
      return
    }
    backupToServer({ name: cleanName, attending, guests: attending ? guests : 0, note: note.trim() })
    const next = { to: contact.name, link: waLink(contact.phone, message), name: cleanName, attending }
    // prikaz se mijenja tek nakon što preglednik otvori link
    setTimeout(() => setSent(next), 400)
  }

  const reset = () => {
    setSent(null)
    setName('')
    setAttending(null)
    setGuests(1)
    setNote('')
    setErrors({})
  }

  return (
    <div className="card rsvp-card" id="potvrda">
      <p className="eyebrow">Potvrda dolaska</p>
      <h2 className="section-title">Hoćete li biti s nama?</h2>
      <p className="rsvp-deadline">
        Molimo Vas da dolazak potvrdite najkasnije do <strong>{DATE_TEXT.rsvpDeadline}</strong>
      </p>
      <Divider />

      {sent ? (
        <div className="thanks" role="status">
          <div className="thanks-icon"><Icon name="whatsapp" size={30} /></div>
          <p className="thanks-title">Još samo jedan korak</p>
          <p>
            Otvoren je WhatsApp s Vašom potvrdom za {sent.to === 'Šejla' ? 'Šejlu' : 'Edvina'}.
            Dodirnite <b>Pošalji</b> u WhatsAppu kako bismo je primili.
          </p>
          <a className="btn btn-gold btn-lg" href={sent.link} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={20} /> Otvori WhatsApp ponovo
          </a>
          <p className="thanks-sign">S ljubavlju, Šejla &amp; Edvin</p>
          <button type="button" className="btn btn-outline" onClick={reset}>
            Potvrda za drugu osobu
          </button>
        </div>
      ) : (
        <form className="form" ref={formRef} onSubmit={(e) => e.preventDefault()} noValidate>
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

          <div className="wa-send">
            <p className="wa-title">Potvrdi dolazak putem WhatsAppa</p>
            {CONTACTS.map((c, i) => (
              <a
                key={c.id}
                className={`btn btn-lg ${i === 0 ? 'btn-gold' : 'btn-outline wa-alt'}`}
                href={waLink(c.phone, message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onSend(c)}
                data-contact={c.id}
              >
                <Icon name="whatsapp" size={20} /> Potvrdi dolazak · {c.name}
              </a>
            ))}
            <p className="wa-hint">Otvorit će se WhatsApp s gotovom porukom – samo dodirnite <b>Pošalji</b>.</p>
          </div>
        </form>
      )}
    </div>
  )
}
