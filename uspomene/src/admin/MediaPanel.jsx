import { useCallback, useEffect, useState } from 'react'
import { formatBytes, formatDate, formatDuration } from '../lib/format.js'
import { IconCheck, IconClose, IconDownload, IconPlay, IconTrash, IconRefresh } from '../components/Icons.jsx'
import { adminAction, adminGet } from './adminApi.js'

const PAGE = 48
const EMPTY = {
  pending: 'Nema fotografija ni videozapisa koji čekaju odobrenje.',
  approved: 'Još ništa nije odobreno.',
  rejected: 'Nema odbijenih stavki.',
}

function Viewer({ item, onClose, onAction, busy }) {
  const url = item.viewUrl
  const error = url ? '' : 'Za ovaj format (npr. HEIC) nema pregleda u pregledniku. Preuzmite original.'
  return (
    <div className="viewer" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="viewer-box">
        <button className="viewer-close" onClick={onClose} aria-label="Zatvori"><IconClose /></button>
        <div className="viewer-media">
          {error && <p className="notice notice-error">{error}</p>}
          {!error && !url && <span className="spinner dark" />}
          {url && item.kind === 'video' && <video src={url} controls playsInline autoPlay />}
          {url && item.kind === 'image' && <img src={url} alt={item.originalName} />}
        </div>
        <div className="viewer-info">
          <strong>{item.guestName}{item.tableLabel ? ` · ${item.tableLabel}` : ''}</strong>
          <span>{item.originalName} · {formatBytes(item.size)}{item.width ? ` · ${item.width}×${item.height}` : ''}</span>
          <span>{formatDate(item.createdAt)}</span>
          {item.reviewedBy && <span>Pregledao/la: {item.reviewedBy}</span>}
        </div>
        <ActionButtons item={item} onAction={onAction} busy={busy} />
      </div>
    </div>
  )
}

function ActionButtons({ item, onAction, busy }) {
  return (
    <div className="item-actions">
      {item.status !== 'approved' && (
        <button className="btn btn-gold btn-small" disabled={busy} onClick={() => onAction('approve', [item.id])}>
          <IconCheck width={16} height={16} /> Odobri
        </button>
      )}
      {item.status !== 'rejected' && (
        <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => onAction('reject', [item.id])}>
          <IconClose width={16} height={16} /> {item.status === 'approved' ? 'Ukloni iz galerije' : 'Odbij'}
        </button>
      )}
      <button
        className="btn btn-ghost btn-small"
        disabled={busy}
        onClick={async () => {
          window.location.href = (await adminGet(`download?id=${item.id}`)).url
        }}
      >
        <IconDownload width={16} height={16} /> Original
      </button>
      <button className="btn btn-danger btn-small" disabled={busy} onClick={() => onAction('delete', [item.id])}>
        <IconTrash width={16} height={16} /> Obriši
      </button>
    </div>
  )
}

export default function MediaPanel({ status, tables = [], initialTable = '', onChanged }) {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [viewer, setViewer] = useState(null)
  const [kind, setKind] = useState('all')
  const [table, setTable] = useState(initialTable)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status, offset: String(page * PAGE) })
      if (kind !== 'all') params.set('kind', kind)
      if (table) params.set('table', table)
      const data = await adminGet(`media?${params}`)
      setRows(data.items)
      setCount(data.total)
      setSelected(new Set())
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
    setLoading(false)
  }, [status, page, kind, table])

  useEffect(() => {
    load()
  }, [load])

  async function act(action, ids) {
    if (!ids.length) return
    if (action === 'delete' && !window.confirm(`Trajno obrisati ${ids.length} ${ids.length === 1 ? 'stavku' : 'stavki'}? Original se briše i iz arhive.`)) return
    setBusy(true)
    setMessage({ type: 'info', text: 'Obrada…' })
    try {
      const results = await adminAction(action, ids, (done, total) =>
        setMessage({ type: 'info', text: `Obrada… ${done} / ${total}` }),
      )
      const failed = Object.entries(results).filter(([, r]) => !r.ok)
      const okCount = ids.length - failed.length
      const verb = { approve: 'Odobreno', reject: 'Odbijeno', delete: 'Obrisano' }[action]
      setMessage(
        failed.length
          ? { type: 'error', text: `${verb}: ${okCount}. Nije uspjelo: ${failed.length} – ${failed[0][1].error}` }
          : { type: 'success', text: `${verb}: ${okCount}.` },
      )
      setViewer(null)
      await load()
      onChanged?.()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
    setBusy(false)
  }

  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const allSelected = rows.length > 0 && selected.size === rows.length
  const ids = [...selected]
  const pages = Math.max(1, Math.ceil(count / PAGE))

  return (
    <section className="panel">
      <div className="panel-bar">
        <div className="segmented">
          {[['all', 'Sve'], ['image', 'Fotografije'], ['video', 'Video']].map(([k, l]) => (
            <button key={k} className={kind === k ? 'active' : ''} onClick={() => { setKind(k); setPage(0) }}>{l}</button>
          ))}
        </div>
        <select className="select" value={table} onChange={(e) => { setTable(e.target.value); setPage(0) }} aria-label="Filter po stolu">
          <option value="">Svi stolovi</option>
          {tables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          <option value="-">Bez stola</option>
        </select>
        <span className="panel-count">{count} ukupno</span>
        <button className="icon-btn" onClick={load} aria-label="Osvježi"><IconRefresh width={20} height={20} /></button>
      </div>

      {rows.length > 0 && (
        <div className="bulk">
          <label className="check">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} />
            <span>Označi sve ({rows.length})</span>
          </label>
          {ids.length > 0 && (
            <div className="bulk-actions">
              {status !== 'approved' && <button className="btn btn-gold btn-small" disabled={busy} onClick={() => act('approve', ids)}>Odobri ({ids.length})</button>}
              {status !== 'rejected' && <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => act('reject', ids)}>{status === 'approved' ? 'Ukloni' : 'Odbij'} ({ids.length})</button>}
              <button className="btn btn-danger btn-small" disabled={busy} onClick={() => act('delete', ids)}>Obriši ({ids.length})</button>
            </div>
          )}
        </div>
      )}

      {message && <p className={`notice notice-${message.type}`} role="status">{message.text}</p>}
      {loading && <div className="panel-empty"><span className="spinner dark" /></div>}
      {!loading && !rows.length && <div className="panel-empty">{EMPTY[status]}</div>}

      {!loading && rows.length > 0 && (
        <ul className="media-grid">
          {rows.map((m) => {
            const thumb = m.thumbUrl
            return (
              <li key={m.id} className={`media-card ${selected.has(m.id) ? 'selected' : ''}`} data-testid="media-card">
                <button className="media-thumb" onClick={() => setViewer(m)} aria-label={`Pregled: ${m.originalName}`}>
                  {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="no-thumb">{m.kind === 'video' ? 'VIDEO' : m.mimeType.split('/')[1].toUpperCase()}</span>}
                  {m.kind === 'video' && <span className="kind"><IconPlay width={14} height={14} />{m.duration ? formatDuration(m.duration) : 'video'}</span>}
                </button>
                <label className="media-select">
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} aria-label="Označi" />
                </label>
                <div className="media-info">
                  <strong>{m.guestName}</strong>
                  <span>{m.tableLabel || 'Bez stola'} · {formatBytes(m.size)}</span>
                  <span>{formatDate(m.createdAt)}</span>
                </div>
                <ActionButtons item={m} onAction={act} busy={busy} />
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="pager">
          <button className="btn btn-ghost btn-small" disabled={page === 0} onClick={() => setPage(page - 1)}>← Nazad</button>
          <span>{page + 1} / {pages}</span>
          <button className="btn btn-ghost btn-small" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Dalje →</button>
        </div>
      )}

      {viewer && <Viewer item={viewer} busy={busy} onClose={() => setViewer(null)} onAction={act} />}
    </section>
  )
}
