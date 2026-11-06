import { useState } from 'react'
import { postJson } from '../lib/api.js'
import { IconHeart } from '../components/Icons.jsx'

export default function Wish({ table, onOpenPrivacy, guestName, setGuestName }) {
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState({ status: 'idle', text: '' })

  async function submit(e) {
    e.preventDefault()
    if (guestName.trim().length < 2) return setState({ status: 'error', text: 'Upišite Vaše ime.' })
    if (message.trim().length < 2) return setState({ status: 'error', text: 'Napišite čestitku.' })
    if (!consent) return setState({ status: 'error', text: 'Potvrdite saglasnost za objavu čestitke.' })
    setState({ status: 'sending', text: '' })
    try {
      await postJson('/api/wish', {
        guestName,
        message,
        table: table?.id || null,
        consent: true,
        website: e.currentTarget.elements.website?.value || '',
      })
      setMessage('')
      setState({ status: 'success', text: 'Hvala Vam na lijepim riječima! Čestitka je stigla mladencima i bit će prikazana nakon odobrenja.' })
    } catch (err) {
      setState({ status: 'error', text: err.message })
    }
  }

  const sending = state.status === 'sending'
  return (
    <form className="wish" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Vaše ime</span>
        <input type="text" value={guestName} maxLength={60} autoComplete="name" required
          onChange={(e) => setGuestName(e.target.value)} disabled={sending} placeholder="Ime i prezime" />
      </label>
      <label className="field">
        <span className="field-label">Čestitka</span>
        <textarea value={message} maxLength={1000} rows={5} required disabled={sending}
          placeholder="Draga Šejla i dragi Edvine…" onChange={(e) => setMessage(e.target.value)} />
        <span className="counter">{message.length} / 1000</span>
      </label>
      <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={sending} />
        <span>
          Saglasan/na sam da se moja čestitka i ime, nakon odobrenja mladenaca, prikažu u galeriji.{' '}
          <button type="button" className="link" onClick={onOpenPrivacy}>Obavijest o privatnosti</button>
        </span>
      </label>
      {state.text && (
        <p className={`notice notice-${state.status === 'success' ? 'success' : 'error'}`} role={state.status === 'success' ? 'status' : 'alert'}>
          {state.text}
        </p>
      )}
      <div className="actions">
        <button className="btn btn-gold" type="submit" disabled={sending}>
          {sending ? <><span className="spinner" /> Šalje se…</> : <><IconHeart width={18} height={18} /> Pošalji čestitku</>}
        </button>
      </div>
    </form>
  )
}
