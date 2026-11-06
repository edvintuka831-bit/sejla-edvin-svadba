import { useCallback, useEffect, useRef, useState } from 'react'
import { getJson } from '../lib/api.js'
import { formatDuration } from '../lib/format.js'
import { IconChevron, IconClose, IconPlay, IconRefresh } from '../components/Icons.jsx'

const PAGE = 24

const TABS = [
  { id: 'all', label: 'Sve' },
  { id: 'image', label: 'Fotografije' },
  { id: 'video', label: 'Videozapisi' },
  { id: 'wishes', label: 'Čestitke' },
]

function Lightbox({ items, index, onClose, onIndex }) {
  const item = items[index]
  const startX = useRef(null)
  const go = useCallback((d) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex])

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', key)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', key)
      document.body.classList.remove('no-scroll')
    }
  }, [go, onClose])

  if (!item) return null
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Pregled"
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (startX.current == null) return
        const dx = e.changedTouches[0].clientX - startX.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        startX.current = null
      }}
    >
      <button className="lb-close" onClick={onClose} aria-label="Zatvori"><IconClose /></button>
      {items.length > 1 && (
        <>
          <button className="lb-nav lb-prev" onClick={() => go(-1)} aria-label="Prethodna"><IconChevron dir="left" /></button>
          <button className="lb-nav lb-next" onClick={() => go(1)} aria-label="Sljedeća"><IconChevron /></button>
        </>
      )}
      <figure className="lb-figure" key={item.id}>
        {item.kind === 'video' ? (
          <video
            src={item.videoUrl}
            poster={item.thumbUrl || undefined}
            controls
            playsInline
            autoPlay
            preload="metadata"
          />
        ) : (
          <img src={item.previewUrl} alt={`Fotografija – ${item.guestName}`} />
        )}
        <figcaption>
          <span className="lb-by">{item.guestName}</span>
          {item.tableLabel && <span className="lb-caption">{item.tableLabel}</span>}
          <span className="lb-count">{index + 1} / {items.length}</span>
        </figcaption>
      </figure>
    </div>
  )
}

export default function Gallery({ refreshKey }) {
  const [tab, setTab] = useState('all')
  const [counts, setCounts] = useState(null)
  const [items, setItems] = useState([])
  const [wishes, setWishes] = useState([])
  const [state, setState] = useState('loading') // loading | ready | error
  const [more, setMore] = useState(false)
  const [open, setOpen] = useState(-1)
  const sentinel = useRef(null)
  const loadingMore = useRef(false)

  const load = useCallback(async (reset) => {
    try {
      if (reset) setState('loading')
      if (tab === 'wishes') {
        const data = await getJson(`/api/gallery?type=wishes&offset=${reset ? 0 : wishes.length}`)
        setCounts(data.counts)
        setWishes((prev) => (reset ? data.items : [...prev, ...data.items]))
        setMore(data.more)
      } else {
        const kind = tab === 'all' ? '' : `&kind=${tab}`
        const data = await getJson(`/api/gallery?type=media${kind}&offset=${reset ? 0 : items.length}`)
        setCounts(data.counts)
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]))
        setMore(data.more)
      }
      setState('ready')
    } catch (err) {
      console.error(err)
      setState('error')
    }
  }, [tab, items, wishes])

  // ponovno učitavanje pri promjeni kartice ili osvježavanju
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    loadRef.current(true)
  }, [tab, refreshKey])

  // beskonačno pomjeranje
  useEffect(() => {
    const el = sentinel.current
    if (!el || !more) return
    const io = new IntersectionObserver(async ([entry]) => {
      if (entry.isIntersecting && !loadingMore.current) {
        loadingMore.current = true
        await loadRef.current(false)
        loadingMore.current = false
      }
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more, items.length, wishes.length])

  const total = counts ? Number(counts.photos) + Number(counts.videos) : 0
  return (
    <div className="gallery">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            {counts && (
              <span className="tab-count">
                {t.id === 'all' ? total : t.id === 'image' ? counts.photos : t.id === 'video' ? counts.videos : counts.wishes}
              </span>
            )}
          </button>
        ))}
        <button className="tab-refresh" onClick={() => load(true)} aria-label="Osvježi galeriju"><IconRefresh width={18} height={18} /></button>
      </div>

      {state === 'loading' && <div className="gallery-empty"><span className="spinner dark" /> Učitavanje…</div>}
      {state === 'error' && (
        <div className="gallery-empty">
          Galerija trenutno nije dostupna. <button className="link" onClick={() => load(true)}>Pokušaj ponovo</button>
        </div>
      )}

      {state === 'ready' && tab !== 'wishes' && (
        items.length ? (
          <ul className="masonry">
            {items.map((m, i) => (
              <li key={m.id} className="masonry-item" style={{ '--i': i % PAGE }}>
                <button onClick={() => setOpen(i)} aria-label={`Otvori ${m.kind === 'video' ? 'video' : 'fotografiju'} – ${m.guestName}`}>
                  {m.thumbUrl ? (
                    <img
                      src={m.thumbUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={m.width || undefined}
                      height={m.height || undefined}
                    />
                  ) : (
                    <video src={`${m.videoUrl}#t=0.5`} muted playsInline preload="metadata" />
                  )}
                  {m.kind === 'video' && (
                    <span className="play"><IconPlay width={20} height={20} />{m.duration ? formatDuration(m.duration) : ''}</span>
                  )}
                  <span className="by">{m.guestName}{m.tableLabel ? ` · ${m.tableLabel}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="gallery-empty">
            Još nema odobrenih uspomena u ovoj kategoriji.<br />Budite prvi koji će podijeliti trenutak!
          </div>
        )
      )}

      {state === 'ready' && tab === 'wishes' && (
        wishes.length ? (
          <ul className="wish-list">
            {wishes.map((w, i) => (
              <li key={w.id} className="wish-card" style={{ '--i': i % PAGE }}>
                <p>{w.message}</p>
                <span>— {w.guestName}{w.tableLabel ? ` · ${w.tableLabel}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="gallery-empty">Još nema objavljenih čestitki.</div>
        )
      )}

      {more && <div ref={sentinel} className="sentinel"><span className="spinner dark" /></div>}

      {open >= 0 && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(-1)} />}
    </div>
  )
}
