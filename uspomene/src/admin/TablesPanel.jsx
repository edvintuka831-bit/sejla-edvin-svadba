import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { downloadZip } from 'client-zip'
import { isFinalAddress, siteBase, tableUrl } from '../lib/config.js'
import { IconDownload, IconGallery, IconPlus, IconTrash } from '../components/Icons.jsx'
import { adminGet, adminPut, safeName } from './adminApi.js'
import { canvasToBlob, cardsPdf, qrOptions, renderCard, saveHref } from './qrCard.js'

const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20)

function QrThumb({ url }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && url) QRCode.toCanvas(ref.current, url, { ...qrOptions, width: 120 }).catch(() => {})
  }, [url])
  return url ? <canvas ref={ref} width={120} height={120} /> : <span className="qr-pending">QR nakon konačne adrese</span>
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  saveHref(url, name)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function TablesPanel({ tables, onSaved, onOpenTable }) {
  const [rows, setRows] = useState(tables)
  const [count, setCount] = useState(tables.length || 10)
  const [prefix, setPrefix] = useState('Stol')
  const [state, setState] = useState({ busy: false, type: 'info', text: '' })
  const [tstats, setTstats] = useState(null)
  const dirty = JSON.stringify(rows) !== JSON.stringify(tables)
  const base = siteBase()
  const final = isFinalAddress(base)

  useEffect(() => setRows(tables), [tables])
  useEffect(() => {
    adminGet('table-stats').then(setTstats).catch(() => {})
  }, [])

  const update = (i, field, value) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [field]: value, ...(field === 'label' && row._new ? { id: slug(value) } : {}) } : row)))

  function generate() {
    const n = Math.max(1, Math.min(200, Number(count) || 0))
    setRows(Array.from({ length: n }, (_, i) => ({ id: String(i + 1), label: `${prefix.trim() || 'Stol'} ${i + 1}` })))
  }

  async function save() {
    setState({ busy: true, type: 'info', text: 'Spremanje…' })
    try {
      const res = await adminPut('tables', { tables: rows.map(({ id, label }) => ({ id: String(id).trim(), label: label.trim() })) })
      onSaved(res.tables)
      setState({ busy: false, type: 'success', text: `Spremljeno: ${res.tables.length} stolova.` })
    } catch (e) {
      setState({ busy: false, type: 'error', text: e.message })
    }
  }

  // Kartice samo za stolove; QR samo za konačnu adresu (inače uzorak bez QR koda)
  const tableCards = () => tables.map((t) => ({ label: t.label, url: final ? tableUrl(t.id) : null, file: safeName(t.label, 30) }))
  const suffix = final ? '' : '-UZORAK'

  async function pdf(layout) {
    setState({ busy: true, type: 'info', text: 'Pravljenje PDF-a…' })
    try {
      const blob = await cardsPdf(tableCards(), layout, (i, n) => setState({ busy: true, type: 'info', text: `Pravljenje PDF-a… kartica ${i} / ${n}` }))
      saveBlob(blob, `Sejla-Edvin-kartice-stolovi-${layout === 'a4' ? 'A4' : 'A6'}${suffix}.pdf`)
      setState({ busy: false, type: 'success', text: final ? `PDF je spreman: ${tables.length} kartica.` : `UZORAK (bez QR kodova) je spreman: ${tables.length} kartica. Prave QR kodove napravite s konačne adrese.` })
    } catch (e) {
      setState({ busy: false, type: 'error', text: `PDF nije napravljen: ${e.message}` })
    }
  }

  async function zipPng() {
    setState({ busy: true, type: 'info', text: 'Pravljenje kartica…' })
    const cards = tableCards()
    async function* files() {
      for (let i = 0; i < cards.length; i++) {
        setState({ busy: true, type: 'info', text: `Pravljenje kartica… ${i + 1} / ${cards.length}` })
        yield { name: `${String(i + 1).padStart(2, '0')}-${cards[i].file}${suffix}.png`, input: await canvasToBlob(await renderCard(cards[i].url, cards[i].label)) }
      }
    }
    saveBlob(await downloadZip(files()).blob(), `Sejla-Edvin-kartice-PNG${suffix}.zip`)
    setState({ busy: false, type: 'success', text: `Preuzeto ${cards.length} kartica (PNG, 300 dpi).` })
  }

  return (
    <section className="panel tables-panel">
      <div className="box">
        <h3>Stolovi</h3>
        <p className="muted">
          Svaki stol ima svoj QR kod; stranica gosta automatski prepoznaje stol. Sve fotografije idu u istu galeriju,
          a ovdje ih možete pregledati po stolovima. Spisak možete mijenjati bilo kada – već poslane fotografije
          zadržavaju oznaku pod kojom su poslane. Ne mijenjajte <strong>oznaku u linku</strong> nakon štampanja kartica.
        </p>
        <ul className="table-rows" data-testid="table-rows">
          {rows.map((r, i) => (
            <li key={i} className="table-row">
              <input type="text" aria-label="Naziv stola" value={r.label} maxLength={40} onChange={(e) => update(i, 'label', e.target.value)} placeholder="npr. Stol 7" />
              <input type="text" aria-label="Oznaka u linku" className="table-id" value={r.id} maxLength={20} onChange={(e) => update(i, 'id', slug(e.target.value) || e.target.value.toLowerCase())} />
              <span className="table-count" title="poslano / odobreno">
                {tstats ? `${tstats.sent[r.id] || 0} / ${tstats.approved[r.id] || 0}` : '…'}
              </span>
              <button type="button" className="icon-btn" onClick={() => onOpenTable(r.id)} aria-label={`Fotografije: ${r.label}`} disabled={dirty}>
                <IconGallery width={18} height={18} />
              </button>
              <button type="button" className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Ukloni ${r.label}`}>
                <IconTrash width={18} height={18} />
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">Broj uz stol: poslano / odobreno. Ikona galerije otvara fotografije tog stola.</p>
        <details className="generate-box">
          <summary>Promijeni broj stolova</summary>
          <div className="generate">
            <label>Broj stolova <input type="number" min="1" max="200" value={count} onChange={(e) => setCount(e.target.value)} /></label>
            <label>Naziv <input type="text" value={prefix} maxLength={20} onChange={(e) => setPrefix(e.target.value)} /></label>
            <button type="button" className="btn btn-ghost btn-small" onClick={generate}>Napravi spisak</button>
          </div>
        </details>
        <div className="actions">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setRows([...rows, { id: '', label: '', _new: true }])}><IconPlus width={16} height={16} /> Dodaj stol</button>
          <button type="button" className="btn btn-gold" onClick={save} disabled={!dirty || state.busy}>Spremi stolove</button>
        </div>
      </div>

      <div className="box">
        <h3>Kartice za stolove</h3>
        <p className="muted">Adresa galerije: <strong>{base}</strong></p>
        {final ? (
          <p className="notice notice-success" data-testid="address-final">
            Adresa je konačna – kartice sadrže prave QR kodove ({tables.length} stolova). Prije štampe skenirajte bar jednu karticu telefonom.
          </p>
        ) : (
          <p className="notice notice-error" data-testid="address-temporary">
            Konačna adresa galerije još nije poznata, pa se prave samo <strong>UZORCI</strong> kartica bez QR koda (za odobrenje izgleda).
            Prave QR kodove dobijate kada otvorite administraciju na konačnoj adresi ili postavite VITE_PUBLIC_SITE_URL.
          </p>
        )}
        {dirty && <p className="notice notice-error">Prvo spremite izmjene stolova.</p>}
        <div className="actions">
          <button className="btn btn-gold" disabled={state.busy || dirty} onClick={() => pdf('a4')} data-testid="pdf-a4">
            <IconDownload width={18} height={18} /> PDF A4 – 4 kartice po stranici{final ? '' : ' (uzorak)'}
          </button>
          <button className="btn btn-ghost" disabled={state.busy || dirty} onClick={() => pdf('a6')} data-testid="pdf-a6">
            PDF A6 – za štampariju{final ? '' : ' (uzorak)'}
          </button>
          <button className="btn btn-ghost" disabled={state.busy || dirty} onClick={zipPng} data-testid="qr-zip">
            PNG kartice (ZIP){final ? '' : ' (uzorak)'}
          </button>
        </div>
        <ul className="qr-grid">
          {tables.map((t) => (
            <li key={t.id} className="qr-item" data-testid="qr-item">
              <QrThumb url={final ? tableUrl(t.id) : null} />
              <strong>{t.label}</strong>
              <span className="qr-url">{tableUrl(t.id)}</span>
            </li>
          ))}
        </ul>
        {final && (
          <p className="muted small">
            Opšti QR bez stola (npr. za ulaz):{' '}
            <button className="link" onClick={async () => saveHref((await renderCard(`${base}/`, null)).toDataURL('image/png'), 'QR-opsti.png')}>preuzmi karticu</button>
          </p>
        )}
      </div>
      {state.text && <p className={`notice notice-${state.type}`} role="status" data-testid="tables-status">{state.text}</p>}
    </section>
  )
}
