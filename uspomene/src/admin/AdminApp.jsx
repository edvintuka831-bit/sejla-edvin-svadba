import { useCallback, useEffect, useState } from 'react'
import { WEDDING } from '../lib/config.js'
import { formatBytes } from '../lib/format.js'
import { Flourish, Monogram } from '../components/Ornaments.jsx'
import { adminGet, adminPost } from './adminApi.js'
import MediaPanel from './MediaPanel.jsx'
import WishesPanel from './WishesPanel.jsx'
import DownloadPanel from './DownloadPanel.jsx'
import TablesPanel from './TablesPanel.jsx'
import SystemPanel from './SystemPanel.jsx'
import './admin.css'

const ACCOUNTS = [
  { id: 'sejla', name: 'Šejla' },
  { id: 'edvin', name: 'Edvin' },
]

function Login({ onLogin, configured }) {
  const [admin, setAdmin] = useState('sejla')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await adminPost('login', { admin, password })
      setPassword('')
      onLogin(res.admin)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const missing = configured && ACCOUNTS.filter((a) => !configured[a.id]).map((a) => a.name)
  return (
    <div className="admin-login">
      <form className="card login-card" onSubmit={submit}>
        <Monogram />
        <p className="eyebrow">Administracija</p>
        <h2>{WEDDING.bride} &amp; {WEDDING.groom}</h2>
        <Flourish />
        <div className="field">
          <span className="field-label">Prijava kao</span>
          <div className="who" role="radiogroup">
            {ACCOUNTS.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={admin === a.id} className={admin === a.id ? 'active' : ''} onClick={() => setAdmin(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label">Šifra</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {missing?.length > 0 && (
          <p className="notice notice-error">Šifra za {missing.join(' i ')} još nije postavljena na Netlifyju (vidi README).</p>
        )}
        {configured && !configured.session && (
          <p className="notice notice-error">Na Netlifyju nedostaje SESSION_SECRET (vidi README).</p>
        )}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <button className="btn btn-gold" type="submit" disabled={busy || !password}>
          {busy ? <><span className="spinner" /> Prijava…</> : 'Prijava'}
        </button>
        <a className="back-link" href="/">← Stranica za goste</a>
      </form>
    </div>
  )
}

function Stats({ stats }) {
  if (!stats) return null
  const cards = [
    ['Na čekanju', stats.pending, 'fotografija i videa', stats.pending ? 'warn' : ''],
    ['Odobreno', stats.approved, `${stats.approvedPhotos} foto · ${stats.approvedVideos} video`],
    ['Ukupno poslano', stats.usage.files, formatBytes(stats.usage.bytes)],
    ['Odbijeno', stats.rejected, 'fotografija i videa'],
    ['Čestitke', stats.wishes.approved, `${stats.wishes.pending} čeka odobrenje`, stats.wishes.pending ? 'warn' : ''],
    ['Prostor', `${Math.round((stats.usage.bytes / stats.storageLimitBytes) * 100)} %`, `${formatBytes(stats.usage.bytes)} od ${formatBytes(stats.storageLimitBytes)}`],
  ]
  return (
    <div className="stats" data-testid="stats">
      {cards.map(([label, value, sub, tone]) => (
        <div key={label} className={`stat ${tone || ''}`}>
          <span className="stat-label">{label}</span>
          <strong className="stat-value">{value}</strong>
          <span className="stat-sub">{sub}</span>
        </div>
      ))}
    </div>
  )
}

const TABS = [
  { id: 'pending', label: 'Na čekanju' },
  { id: 'approved', label: 'Odobreno' },
  { id: 'rejected', label: 'Odbijeno' },
  { id: 'wishes', label: 'Čestitke' },
  { id: 'tables', label: 'Stolovi i QR' },
  { id: 'download', label: 'Preuzimanje' },
  { id: 'system', label: 'Sistem' },
]

export default function AdminApp() {
  const [admin, setAdmin] = useState(undefined)
  const [configured, setConfigured] = useState(null)
  const [tab, setTab] = useState('pending')
  const [stats, setStats] = useState(null)
  const [tables, setTables] = useState([])
  const [tableFilter, setTableFilter] = useState('')

  useEffect(() => {
    adminGet('me')
      .then((r) => {
        setConfigured(r.configured)
        setAdmin(r.admin)
      })
      .catch(() => setAdmin(null))
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([adminGet('stats'), adminGet('tables')])
      setStats(s)
      setTables(t.tables)
    } catch (err) {
      if (err.status === 401) setAdmin(null)
    }
  }, [])

  useEffect(() => {
    if (admin) refresh()
  }, [admin, refresh])

  if (admin === undefined) return <div className="boot"><span className="spinner dark" /></div>
  if (!admin) return <Login onLogin={setAdmin} configured={configured} />

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Administracija</p>
          <h1>{WEDDING.bride} &amp; {WEDDING.groom}</h1>
        </div>
        <div className="admin-user">
          <span>Prijavljeni: <strong>{admin.name}</strong></span>
          <button className="btn btn-ghost btn-small" onClick={async () => { await adminPost('logout', {}).catch(() => {}); setAdmin(null) }}>
            Odjava
          </button>
        </div>
      </header>
      <Stats stats={stats} />
      <nav className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => { setTableFilter(''); setTab(t.id) }}>
            {t.label}
            {t.id === 'pending' && stats?.pending > 0 && <span className="dot">{stats.pending}</span>}
            {t.id === 'wishes' && stats?.wishes.pending > 0 && <span className="dot">{stats.wishes.pending}</span>}
          </button>
        ))}
      </nav>
      <main className="admin-main">
        {['pending', 'approved', 'rejected'].includes(tab) && <MediaPanel key={`${tab}-${tableFilter}`} status={tab} tables={tables} initialTable={tableFilter} onChanged={refresh} />}
        {tab === 'wishes' && <WishesPanel onChanged={refresh} />}
        {tab === 'tables' && <TablesPanel tables={tables} onSaved={setTables} onOpenTable={(id) => { setTableFilter(id); setTab('approved') }} />}
        {tab === 'download' && <DownloadPanel />}
        {tab === 'system' && <SystemPanel />}
      </main>
    </div>
  )
}
