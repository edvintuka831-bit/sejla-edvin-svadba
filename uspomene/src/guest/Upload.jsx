import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, postJson, putSigned } from '../lib/api.js'
import { kindOf, normalizeType, prepareImage, prepareVideo } from '../lib/media.js'
import { formatBytes, plural } from '../lib/format.js'
import { IconAlert, IconCamera, IconCheck, IconClose, IconPlus, IconVideo } from '../components/Icons.jsx'

const MB = 1024 * 1024
const CONCURRENCY = 3
let seq = 0

function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock
    navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => lock?.release?.().catch(() => {})
  }, [active])
}

const STATUS_TEXT = {
  ready: 'Spremno',
  preparing: 'Priprema…',
  uploading: 'Šalje se',
  verifying: 'Provjera…',
  done: 'Poslano',
  error: 'Greška',
  invalid: 'Ne može se poslati',
}

export default function Upload({ limits, table, onOpenPrivacy, guestName, setGuestName }) {
  const [items, setItems] = useState([])
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // { type: 'error'|'success'|'info', text }
  const inputRef = useRef(null)
  const blobs = useRef(new Map())
  const itemsRef = useRef(items)
  itemsRef.current = items

  useWakeLock(busy)

  // Upozorenje ako gost zatvori stranicu usred slanja
  useEffect(() => {
    if (!busy) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  useEffect(() => () => itemsRef.current.forEach((it) => it.url && URL.revokeObjectURL(it.url)), [])

  const statusRef = useRef({})
  const patch = useCallback((id, values) => {
    if (values.status) statusRef.current[id] = values.status
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...values } : it)))
  }, [])

  function addFiles(fileList) {
    const files = [...fileList]
    if (!files.length) return
    setNotice(null)
    const next = files.map((file) => {
      const type = normalizeType(file)
      const kind = kindOf(type)
      const item = { id: `f${++seq}`, file, type, kind, name: file.name, size: file.size, status: 'ready', progress: 0, error: '' }
      if (!kind) {
        item.status = 'invalid'
        item.error = 'Format nije podržan (dozvoljeno: JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM).'
      } else if (kind === 'image' && file.size > limits.maxImageMB * MB) {
        item.status = 'invalid'
        item.error = `Fotografija je veća od ${limits.maxImageMB} MB.`
      } else if (kind === 'video' && file.size > limits.maxVideoMB * MB) {
        item.status = 'invalid'
        item.error = `Video je veći od ${limits.maxVideoMB} MB. Skratite ga ili pošaljite u manjoj rezoluciji.`
      } else if (!file.size) {
        item.status = 'invalid'
        item.error = 'Datoteka je prazna.'
      }
      if (kind) item.url = URL.createObjectURL(file)
      return item
    })
    setItems((list) => [...list.filter((it) => it.status !== 'done'), ...next])
  }

  function remove(id) {
    setItems((list) => {
      const it = list.find((x) => x.id === id)
      if (it?.url) URL.revokeObjectURL(it.url)
      blobs.current.delete(id)
      return list.filter((x) => x.id !== id)
    })
  }

  function clearDone() {
    setItems((list) => {
      list.filter((x) => x.status === 'done').forEach((x) => x.url && URL.revokeObjectURL(x.url))
      return list.filter((x) => x.status !== 'done')
    })
    setNotice(null)
  }

  async function prepare(item) {
    if (blobs.current.has(item.id)) return blobs.current.get(item.id)
    patch(item.id, { status: 'preparing', error: '' })
    let extra
    if (item.kind === 'image') {
      const r = await prepareImage(item.file)
      extra = { preview: r.preview, thumb: r.thumb, width: r.width, height: r.height }
    } else {
      const r = await prepareVideo(item.file)
      extra = { preview: null, thumb: r.thumb, width: r.width ?? null, height: r.height ?? null, duration: r.duration ?? null }
    }
    blobs.current.set(item.id, extra)
    return extra
  }

  async function sendBatch(batch) {
    // 1. priprema pregleda (jedna po jedna – štedi memoriju telefona)
    const prepared = []
    for (const item of batch) prepared.push({ item, extra: await prepare(item) })

    // 2. najava serveru
    batch.forEach((it) => patch(it.id, { status: 'uploading', progress: 0 }))
    let init
    try {
      init = await postJson('/api/upload/init', {
        guestName,
        table: table?.id || null,
        consent: true,
        website: document.getElementById('website-upload')?.value || '',
        files: prepared.map(({ item, extra }) => ({
          clientId: item.id,
          name: item.name,
          type: item.type,
          size: item.size,
          width: extra.width,
          height: extra.height,
          duration: extra.duration,
          previewSize: extra.preview?.size || null,
          thumbSize: extra.thumb?.size || null,
        })),
      })
    } catch (err) {
      batch.forEach((it) => patch(it.id, { status: 'error', error: err.message }))
      throw err
    }

    // 3. upload (po 3 istovremeno)
    const uploaded = []
    const queue = [...init.items]
    const worker = async () => {
      while (queue.length) {
        const target = queue.shift()
        const { item, extra } = prepared.find((p) => p.item.id === target.clientId)
        try {
          await putSigned(target.original, item.file, item.type, (loaded, total) =>
            patch(item.id, { progress: Math.min(0.97, loaded / total) }),
          )
          // pregled i sličica su dodatak – njihova greška ne ruši slanje
          if (target.preview && extra.preview) await putSigned(target.preview, extra.preview, 'image/jpeg').catch(() => {})
          if (target.thumb && extra.thumb) await putSigned(target.thumb, extra.thumb, 'image/jpeg').catch(() => {})
          patch(item.id, { status: 'verifying', progress: 0.98 })
          uploaded.push({ id: target.id, itemId: item.id })
        } catch (err) {
          patch(item.id, { status: 'error', error: err.message || 'Slanje nije uspjelo.' })
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (!uploaded.length) return

    // 4. server provjerava stvarni sadržaj
    try {
      const { results } = await postJson('/api/upload/complete', {
        batchId: init.batchId,
        batchKey: init.batchKey,
        ids: uploaded.map((u) => u.id),
      })
      for (const u of uploaded) {
        const r = results[u.id]
        if (r?.ok) {
          patch(u.itemId, { status: 'done', progress: 1 })
          blobs.current.delete(u.itemId)
        } else patch(u.itemId, { status: 'error', error: r?.error || 'Provjera nije uspjela.' })
      }
    } catch (err) {
      uploaded.forEach((u) => patch(u.itemId, { status: 'error', error: err.message }))
    }
  }

  async function send() {
    const queue = items.filter((it) => it.status === 'ready' || it.status === 'error')
    if (!queue.length) return
    if (!consent) {
      setNotice({ type: 'error', text: 'Prije slanja potvrdite saglasnost za dijeljenje sadržaja.' })
      return
    }
    setBusy(true)
    setNotice({ type: 'info', text: 'Slanje je u toku – ne zatvarajte stranicu.' })
    let fatal = null
    for (let i = 0; i < queue.length; i += limits.maxFilesPerBatch) {
      try {
        await sendBatch(queue.slice(i, i + limits.maxFilesPerBatch))
      } catch (err) {
        if (err instanceof ApiError && [0, 404, 429, 503, 507].includes(err.status)) {
          fatal = err
          queue.slice(i + limits.maxFilesPerBatch).forEach((it) => patch(it.id, { status: 'error', error: err.message }))
          break
        }
      }
    }
    setBusy(false)
    const done = queue.filter((it) => statusRef.current[it.id] === 'done').length
    const failed = queue.length - done
    if (fatal) setNotice({ type: 'error', text: fatal.message })
    else if (failed && done) setNotice({ type: 'error', text: `Poslano ${done}, ali ${failed} ${plural(failed, 'datoteka nije stigla', 'datoteke nisu stigle', 'datoteka nije stiglo')}. Dodirnite „Pokušaj ponovo“.` })
    else if (failed) setNotice({ type: 'error', text: 'Slanje nije uspjelo. Provjerite internet vezu i dodirnite „Pokušaj ponovo“.' })
    else setNotice({ type: 'success', text: `Hvala Vam! ${done} ${plural(done, 'uspomena je stigla', 'uspomene su stigle', 'uspomena je stiglo')} mladencima. Bit će vidljive u galeriji nakon odobrenja.` })
  }

  const pending = items.filter((it) => it.status === 'ready' || it.status === 'error')
  const invalid = items.filter((it) => it.status === 'invalid')
  const doneCount = items.filter((it) => it.status === 'done').length
  const active = items.filter((it) => it.status !== 'invalid')
  const totalBytes = active.reduce((s, it) => s + it.size, 0)
  const sentBytes = active.reduce((s, it) => s + it.size * (it.status === 'done' ? 1 : it.progress || 0), 0)
  const overall = totalBytes ? Math.round((sentBytes / totalBytes) * 100) : 0
  const hasErrors = items.some((it) => it.status === 'error')

  return (
    <div className="upload">
      <label className="field">
        <span className="field-label">Vaše ime <small>(nije obavezno)</small></span>
        <input
          type="text"
          value={guestName}
          maxLength={60}
          autoComplete="name"
          placeholder="npr. Amra i Kenan"
          onChange={(e) => setGuestName(e.target.value)}
          disabled={busy}
        />
      </label>
      <input id="website-upload" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.heic,.heif,.mov"
        className="visually-hidden"
        data-testid="file-input"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <button type="button" className="dropzone" onClick={() => inputRef.current?.click()} disabled={busy}>
        <span className="dropzone-icons">
          <IconCamera />
          <IconVideo />
        </span>
        <strong>{items.length ? 'Dodajte još' : 'Izaberite fotografije i videozapise'}</strong>
        <small>
          Više odjednom · fotografije do {limits.maxImageMB} MB · video do {limits.maxVideoMB} MB
        </small>
      </button>

      {items.length > 0 && (
        <ul className="file-grid" aria-label="Izabrane datoteke">
          {items.map((it) => (
            <li key={it.id} className={`file-tile is-${it.status}`} data-status={it.status}>
              <div className="file-thumb">
                {it.kind === 'image' && <img src={it.url} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />}
                {it.kind === 'video' && <video src={`${it.url}#t=0.5`} muted playsInline preload="metadata" />}
                {it.kind === 'video' && <span className="badge-video"><IconVideo width={14} height={14} /></span>}
                {(it.status === 'uploading' || it.status === 'verifying' || it.status === 'preparing') && (
                  <span className="file-progress"><span style={{ width: `${Math.round((it.progress || 0.03) * 100)}%` }} /></span>
                )}
                {it.status === 'done' && <span className="file-state ok"><IconCheck /></span>}
                {(it.status === 'error' || it.status === 'invalid') && <span className="file-state bad"><IconAlert /></span>}
                {!busy && it.status !== 'done' && (
                  <button type="button" className="file-remove" onClick={() => remove(it.id)} aria-label={`Ukloni ${it.name}`}>
                    <IconClose width={14} height={14} />
                  </button>
                )}
              </div>
              <div className="file-meta">
                <span className="file-name" title={it.name}>{it.name}</span>
                <span className="file-status">
                  {STATUS_TEXT[it.status]}
                  {it.status === 'uploading' && ` ${Math.round(it.progress * 100)}%`}
                  {it.status === 'ready' && ` · ${formatBytes(it.size)}`}
                </span>
                {it.error && <span className="file-error">{it.error}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {busy && (
        <div className="overall" role="status" aria-live="polite">
          <div className="overall-bar"><span style={{ width: `${overall}%` }} /></div>
          <span>Slanje… {overall}% · {doneCount} od {active.length}</span>
        </div>
      )}

      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
        <span>
          Saglasan/na sam da mladenci prime moje fotografije i videozapise i da ih, nakon odobrenja,
          objave u galeriji vidljivoj gostima s linkom. Na sadržaju su osobe koje se slažu s objavom.{' '}
          <button type="button" className="link" onClick={onOpenPrivacy}>Obavijest o privatnosti</button>
        </span>
      </label>

      {notice && (
        <p className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}
      {invalid.length > 0 && !busy && (
        <p className="notice notice-error" role="alert">
          {invalid.length} {plural(invalid.length, 'datoteka se ne može poslati', 'datoteke se ne mogu poslati', 'datoteka se ne može poslati')} – pogledajte oznaku na sličici.
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn btn-gold" onClick={send} disabled={busy || !pending.length}>
          {busy ? (
            <><span className="spinner" /> Šalje se…</>
          ) : hasErrors ? (
            'Pokušaj ponovo'
          ) : (
            <>
              <IconPlus width={18} height={18} /> Pošalji {pending.length || ''}{' '}
              {pending.length ? plural(pending.length, 'datoteku', 'datoteke', 'datoteka') : 'uspomene'}
            </>
          )}
        </button>
        {doneCount > 0 && !busy && (
          <button type="button" className="btn btn-ghost" onClick={clearDone}>Očisti poslano</button>
        )}
      </div>
    </div>
  )
}
