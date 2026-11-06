import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { IS_CONFIGURED, WEDDING } from '../lib/config.js'
import { formatBytes } from '../lib/format.js'
import { Flourish, Monogram } from '../components/Ornaments.jsx'
import MediaPanel from './MediaPanel.jsx'
import WishesPanel from './WishesPanel.jsx'
import DownloadPanel from './DownloadPanel.jsx'
import QrPanel from './QrPanel.jsx'
import './admin.css'

function Login({ error: initialError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError || '')

  useEffect(() => setError(initialError || ''), [initialError])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) {
      setError(
        /rate|too many/i.test(err.message)
          ? 'Previše pokušaja prijave. Sačekajte nekoliko minuta.'
          : /invalid/i.test(err.message)
            ? 'Pogrešan email ili šifra.'
            : `Prijava nije uspjela: ${err.message}`,
      )
    }
  }

  return (
    <div className="admin-login">
      <form className="card login-card" onSubmit={submit}>
        <Monogram />
        <p className="eyebrow">Administracija</p>
        <h2>{WEDDING.bride} &amp; {WEDDING.groom}</h2>
        <Flourish />
        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Šifra</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <button className="btn btn-gold" type="submit" disabled={busy}>
          {busy ? <><span className="spinner" /> Prijava…</> : 'Prijava'}
        </button>
        <a className="back-link" href="/">← Stranica za goste</a>
      </form>
    </div>
  )
}

function Stats({ stats }) {
  if (!stats) return null
  const n = (k) => Number(stats[k] || 0)
  const cards = [
    ['Na čekanju', n('pending_photos') + n('pending_videos'), `${n('pending_photos')} foto · ${n('pending_videos')} video`, 'warn'],
    ['Odobreno', n('approved_photos') + n('approved_videos'), `${n('approved_photos')} foto · ${n('approved_videos')} video`],
    ['Ukupno poslano', n('total_uploaded'), `${formatBytes(n('total_bytes'))} · ${n('uploaders')} slanja`],
    ['Odbijeno', n('rejected_media'), 'fotografija i videa'],
    ['Čestitke', n('approved_wishes'), `${n('pending_wishes')} čeka odobrenje`, n('pending_wishes') ? 'warn' : ''],
    ['Zauzet prostor', formatBytes(n('storage_bytes')), 'originali + galerija'],
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
  { id: 'download', label: 'Preuzimanje' },
  { id: 'qr', label: 'QR kod' },
]

export default function AdminApp() {
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(null)
  const [denied, setDenied] = useState('')
  const [tab, setTab] = useState('pending')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setIsAdmin(null)
    let cancelled = false
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (cancelled) return
      if (error || data !== true) {
        setDenied('Ovaj račun nema administratorska prava.')
        setIsAdmin(false)
        supabase.auth.signOut()
      } else {
        setDenied('')
        setIsAdmin(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const refreshStats = useCallback(async () => {
    const { data } = await supabase.rpc('admin_stats')
    if (data?.[0]) setStats(data[0])
  }, [])

  useEffect(() => {
    if (isAdmin) refreshStats()
  }, [isAdmin, refreshStats])

  if (!IS_CONFIGURED) {
    return (
      <div className="admin-login">
        <p className="notice notice-error">Nedostaju VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY. Pogledajte README.</p>
      </div>
    )
  }
  if (session === undefined || (session && isAdmin === null)) {
    return <div className="boot"><span className="spinner dark" /></div>
  }
  if (!session || !isAdmin) return <Login error={denied} />

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Administracija</p>
          <h1>{WEDDING.bride} &amp; {WEDDING.groom}</h1>
        </div>
        <div className="admin-user">
          <span>{session.user.email}</span>
          <button className="btn btn-ghost btn-small" onClick={() => supabase.auth.signOut()}>Odjava</button>
        </div>
      </header>
      <Stats stats={stats} />
      <nav className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'pending' && stats && Number(stats.pending_photos) + Number(stats.pending_videos) > 0 && (
              <span className="dot">{Number(stats.pending_photos) + Number(stats.pending_videos)}</span>
            )}
            {t.id === 'wishes' && stats && Number(stats.pending_wishes) > 0 && <span className="dot">{stats.pending_wishes}</span>}
          </button>
        ))}
      </nav>
      <main className="admin-main">
        {['pending', 'approved', 'rejected'].includes(tab) && <MediaPanel key={tab} status={tab} onChanged={refreshStats} />}
        {tab === 'wishes' && <WishesPanel onChanged={refreshStats} />}
        {tab === 'download' && <DownloadPanel />}
        {tab === 'qr' && <QrPanel />}
      </main>
    </div>
  )
}
