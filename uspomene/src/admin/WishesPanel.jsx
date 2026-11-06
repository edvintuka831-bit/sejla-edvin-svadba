import { useCallback, useEffect, useState } from 'react'
import { formatDate } from '../lib/format.js'
import { adminAction, adminGet } from './adminApi.js'

const FILTERS = [
  ['pending', 'Na čekanju'],
  ['approved', 'Objavljene'],
  ['rejected', 'Odbijene'],
]

export default function WishesPanel({ onChanged }) {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows((await adminGet(`wishes?status=${status}`)).items)
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
    setLoading(false)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function act(action, ids) {
    if (action === 'wish-delete' && !window.confirm('Trajno obrisati čestitku?')) return
    setBusy(true)
    try {
      await adminAction(action, ids)
      setMessage({ type: 'success', text: { 'wish-approve': 'Čestitka objavljena.', 'wish-reject': 'Čestitka odbijena.', 'wish-delete': 'Čestitka obrisana.' }[action] })
      await load()
      onChanged?.()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
    setBusy(false)
  }

  return (
    <section className="panel">
      <div className="panel-bar">
        <div className="segmented">
          {FILTERS.map(([k, l]) => (
            <button key={k} className={status === k ? 'active' : ''} onClick={() => { setStatus(k); setMessage(null) }}>{l}</button>
          ))}
        </div>
        {status === 'pending' && rows.length > 1 && (
          <button className="btn btn-gold btn-small" disabled={busy} onClick={() => act('wish-approve', rows.map((r) => r.id))}>
            Objavi sve ({rows.length})
          </button>
        )}
      </div>
      {message && <p className={`notice notice-${message.type}`} role="status">{message.text}</p>}
      {loading && <div className="panel-empty"><span className="spinner dark" /></div>}
      {!loading && !rows.length && <div className="panel-empty">Nema čestitki u ovoj kategoriji.</div>}
      <ul className="admin-wishes">
        {rows.map((w) => (
          <li key={w.id} className="admin-wish" data-testid="wish-card">
            <p>{w.message}</p>
            <div className="admin-wish-meta">
              <strong>{w.guestName}{w.tableLabel ? ` · ${w.tableLabel}` : ''}</strong>
              <span>{formatDate(w.createdAt)}</span>
            </div>
            <div className="item-actions">
              {w.status !== 'approved' && <button className="btn btn-gold btn-small" disabled={busy} onClick={() => act('wish-approve', [w.id])}>Objavi</button>}
              {w.status !== 'rejected' && <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => act('wish-reject', [w.id])}>{w.status === 'approved' ? 'Ukloni' : 'Odbij'}</button>}
              <button className="btn btn-danger btn-small" disabled={busy} onClick={() => act('wish-delete', [w.id])}>Obriši</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
