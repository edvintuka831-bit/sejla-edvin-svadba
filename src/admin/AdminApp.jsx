import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, AuthError } from './api.js'
import { downloadCsv, downloadXlsx, formatDate } from './exports.js'

const MAX_GUESTS = 20
const osoba = (n) => (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'osobe' : 'osoba')

function Login({ onLoggedIn, notice }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(notice || '')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      await api.login(password)
      setPassword('')
      onLoggedIn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="a-center">
      <form className="a-card a-login" onSubmit={submit}>
        <p className="a-mono">Š <i>&amp;</i> E</p>
        <h1>Potvrde dolaska</h1>
        <p className="a-muted">Privatni pristup za Šejlu i Edvina</p>
        <label className="a-field">
          <span>Šifra</span>
          <div className="a-pass">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
            <button type="button" onClick={() => setShow((s) => !s)}>{show ? 'Sakrij' : 'Prikaži'}</button>
          </div>
        </label>
        {error && <p className="a-error" role="alert">{error}</p>}
        <button className="a-btn a-btn-gold" disabled={busy || !password}>{busy ? 'Prijava...' : 'Prijavi se'}</button>
      </form>
    </main>
  )
}

function EditDialog({ rsvp, onClose, onSaved, onExpired }) {
  const [name, setName] = useState(rsvp.name)
  const [attending, setAttending] = useState(rsvp.attending)
  const [guests, setGuests] = useState(rsvp.attending ? rsvp.guests : 1)
  const [note, setNote] = useState(rsvp.note || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await api.update(rsvp.id, { name, attending, guests: attending ? guests : 0, note })
      onSaved(updated)
    } catch (err) {
      if (err instanceof AuthError) return onExpired(err.message)
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="a-backdrop" onClick={onClose}>
      <form className="a-card a-dialog" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>Uredi odgovor</h2>
        <label className="a-field">
          <span>Ime i prezime</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <div className="a-field">
          <span>Dolazak</span>
          <div className="a-seg">
            <button type="button" className={attending ? 'on' : ''} onClick={() => setAttending(true)}>Dolazi</button>
            <button type="button" className={!attending ? 'on' : ''} onClick={() => setAttending(false)}>Ne može doći</button>
          </div>
        </div>
        {attending && (
          <div className="a-field">
            <span>Broj osoba</span>
            <div className="a-stepper">
              <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} disabled={guests <= 1}>−</button>
              <output>{guests}</output>
              <button type="button" onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))} disabled={guests >= MAX_GUESTS}>+</button>
            </div>
          </div>
        )}
        <label className="a-field">
          <span>Napomena</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
        </label>
        {error && <p className="a-error" role="alert">{error}</p>}
        <div className="a-row">
          <button type="button" className="a-btn" onClick={onClose}>Odustani</button>
          <button className="a-btn a-btn-gold" disabled={busy}>{busy ? 'Spremam...' : 'Spremi'}</button>
        </div>
      </form>
    </div>
  )
}

function Dashboard({ onLogout, onExpired }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)

  const guard = useCallback(
    async (fn) => {
      try {
        return await fn()
      } catch (err) {
        if (err instanceof AuthError) onExpired(err.message)
        else setError(err.message)
        return undefined
      }
    },
    [onExpired],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const data = await guard(() => api.list())
    if (data) setList(data)
    setLoading(false)
  }, [guard])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const all = list || []
    const yes = all.filter((r) => r.attending)
    return {
      total: all.length,
      yes: yes.length,
      no: all.length - yes.length,
      guests: yes.reduce((s, r) => s + r.guests, 0),
    }
  }, [list])

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('bs')
    return (list || []).filter(
      (r) =>
        (filter === 'all' || (filter === 'yes' ? r.attending : !r.attending)) &&
        (!q || r.name.toLocaleLowerCase('bs').includes(q)),
    )
  }, [list, query, filter])

  const remove = async (r) => {
    if (!window.confirm(`Obrisati odgovor: ${r.name}?\nOvo se ne može poništiti.`)) return
    const ok = await guard(() => api.remove(r.id))
    if (ok) setList((l) => l.filter((x) => x.id !== r.id))
  }

  const logout = async () => {
    await api.logout().catch(() => {})
    onLogout()
  }

  return (
    <main className="a-wrap">
      <header className="a-header">
        <div>
          <p className="a-mono a-mono-sm">Š <i>&amp;</i> E</p>
          <h1>Potvrde dolaska</h1>
          <p className="a-muted">Kategorija: <b>GOSTI KOD MLADOŽENJE</b> · okupljanje 23.01.2027. u 12:00 · rok za potvrdu 02.01.2027.</p>
        </div>
        <button className="a-btn a-btn-sm" onClick={logout}>Odjava</button>
      </header>

      <section className="a-stats">
        <div className="a-stat a-stat-main"><b>{stats.guests}</b><span>ukupno gostiju dolazi</span></div>
        <div className="a-stat"><b>{stats.yes}</b><span>potvrdilo dolazak</span></div>
        <div className="a-stat"><b>{stats.no}</b><span>ne dolazi</span></div>
        <div className="a-stat"><b>{stats.total}</b><span>ukupno odgovora</span></div>
      </section>

      <section className="a-tools">
        <input
          type="search"
          className="a-search"
          placeholder="Pretraži po imenu..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="a-seg">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Svi</button>
          <button className={filter === 'yes' ? 'on' : ''} onClick={() => setFilter('yes')}>Dolaze</button>
          <button className={filter === 'no' ? 'on' : ''} onClick={() => setFilter('no')}>Ne dolaze</button>
        </div>
        <div className="a-row a-downloads">
          <button className="a-btn a-btn-gold" onClick={() => downloadXlsx(visible)} disabled={!visible.length}>Preuzmi Excel</button>
          <button className="a-btn" onClick={() => downloadCsv(visible)} disabled={!visible.length}>Preuzmi CSV</button>
          <button className="a-btn" onClick={load} disabled={loading}>{loading ? 'Učitavam...' : 'Osvježi'}</button>
        </div>
      </section>

      {error && <p className="a-error" role="alert">{error}</p>}

      {list === null ? (
        <p className="a-muted a-empty">Učitavam odgovore...</p>
      ) : visible.length === 0 ? (
        <p className="a-muted a-empty">{list.length ? 'Nema rezultata za ovu pretragu.' : 'Još nema potvrda dolaska.'}</p>
      ) : (
        <ul className="a-list">
          {visible.map((r) => (
            <li key={r.id} className="a-card a-item">
              <div className="a-item-top">
                <h3>{r.name}</h3>
                <span className="a-badge group">{r.group || 'GOSTI KOD MLADOŽENJE'}</span>
                <span className={`a-badge ${r.attending ? 'yes' : 'no'}`}>
                  {r.attending ? `Dolazi · ${r.guests} ${osoba(r.guests)}` : 'Ne može doći'}
                </span>
              </div>
              {r.note && <p className="a-note">„{r.note}“</p>}
              <p className="a-date">
                Potvrđeno: {formatDate(r.createdAt)}
                {r.updatedAt && r.updatedAt !== r.createdAt && <> · izmijenjeno {formatDate(r.updatedAt)}</>}
              </p>
              <div className="a-row">
                <button className="a-btn a-btn-sm" onClick={() => setEditing(r)}>Uredi</button>
                <button className="a-btn a-btn-sm a-btn-danger" onClick={() => remove(r)}>Obriši</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditDialog
          rsvp={editing}
          onClose={() => setEditing(null)}
          onExpired={onExpired}
          onSaved={(u) => {
            setList((l) => l.map((x) => (x.id === u.id ? u : x)))
            setEditing(null)
          }}
        />
      )}
    </main>
  )
}

export default function AdminApp() {
  const [state, setState] = useState('loading') // loading | login | ready | error
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api
      .session()
      .then((s) => setState(s.authenticated ? 'ready' : 'login'))
      .catch((err) => {
        setNotice(err.message)
        setState('error')
      })
  }, [])

  const expired = useCallback((msg) => {
    setNotice(msg)
    setState('login')
  }, [])

  if (state === 'loading') return <main className="a-center"><p className="a-muted">Učitavam...</p></main>
  if (state === 'error') {
    return (
      <main className="a-center">
        <div className="a-card a-login">
          <h1>Admin nije dostupan</h1>
          <p className="a-error">{notice}</p>
          <p className="a-muted">Provjerite da je u Netlifyju postavljena varijabla ADMIN_PASSWORD i ponovo objavite stranicu.</p>
        </div>
      </main>
    )
  }
  if (state === 'login') return <Login notice={notice} onLoggedIn={() => { setNotice(''); setState('ready') }} />
  return <Dashboard onLogout={() => { setNotice(''); setState('login') }} onExpired={expired} />
}
