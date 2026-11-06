import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { downloadZip } from 'client-zip'
import { siteBase, tableUrl } from '../lib/config.js'
import { IconDownload, IconPlus, IconTrash } from '../components/Icons.jsx'
import { adminPut, safeName } from './adminApi.js'
import { canvasToBlob, qrOptions, renderCard, saveHref } from './qrCard.js'

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
    if (ref.current) QRCode.toCanvas(ref.current, url, { ...qrOptions, width: 132 }).catch(() => {})
  }, [url])
  return <canvas ref={ref} width={132} height={132} />
}

export default function TablesPanel({ tables, onSaved }) {
  const [rows, setRows] = useState(tables)
  const [count, setCount] = useState(tables.length || 20)
  const [prefix, setPrefix] = useState('Sto')
  const [state, setState] = useState({ busy: false, type: 'info', text: '' })
  const [printCards, setPrintCards] = useState([])
  const dirty = JSON.stringify(rows) !== JSON.stringify(tables)
  const base = siteBase()
  const temporary = /localhost|127\.0\.0\.1|deploy-preview|--/.test(base)

  useEffect(() => setRows(tables), [tables])

  const update = (i, field, value) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [field]: value, ...(field === 'label' && row._new ? { id: slug(value) } : {}) } : row)))

  function generate() {
    const n = Math.max(1, Math.min(200, Number(count) || 0))
    const existing = new Map(rows.map((r) => [r.id, r]))
    const generated = Array.from({ length: n }, (_, i) => existing.get(String(i + 1)) || { id: String(i + 1), label: `${prefix} ${i + 1}` })
    const extra = rows.filter((r) => !/^\d+$/.test(r.id))
    setRows([...generated, ...extra])
  }

  async function save() {
    setState({ busy: true, type: 'info', text: 'Spremanje…' })
    try {
      const res = await adminPut('tables', { tables: rows.map(({ id, label }) => ({ id: String(id).trim(), label: label.trim() })) })
      onSaved(res.tables)
      setState({ busy: false, type: 'success', text: `Spremljeno: ${res.tables.length} stolova. QR kodovi su spremni.` })
    } catch (e) {
      setState({ busy: false, type: 'error', text: e.message })
    }
  }

  const allCards = () => [{ label: null, url: `${base}/`, file: 'Opsti' }, ...tables.map((t) => ({ label: t.label, url: tableUrl(t.id), file: safeName(t.label, 30) }))]

  async function downloadOne(card) {
    const c = await renderCard(card.url, card.label)
    saveHref(c.toDataURL('image/png'), `QR-${card.file}.png`)
  }

  async function downloadAll() {
    setState({ busy: true, type: 'info', text: 'Pravljenje kartica…' })
    const cards = allCards()
    async function* files() {
      for (let i = 0; i < cards.length; i++) {
        setState({ busy: true, type: 'info', text: `Pravljenje kartica… ${i + 1} / ${cards.length}` })
        yield { name: `QR-${String(i).padStart(2, '0')}-${cards[i].file}.png`, input: await canvasToBlob(await renderCard(cards[i].url, cards[i].label)) }
      }
    }
    const blob = await downloadZip(files()).blob()
    const url = URL.createObjectURL(blob)
    saveHref(url, 'Sejla-Edvin-QR-kartice.zip')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    setState({ busy: false, type: 'success', text: `Preuzeto ${cards.length} kartica (ZIP).` })
  }

  async function print() {
    setState({ busy: true, type: 'info', text: 'Priprema za štampu…' })
    const cards = []
    for (const card of allCards()) cards.push((await renderCard(card.url, card.label)).toDataURL('image/png'))
    setPrintCards(cards)
    setState({ busy: false, type: 'info', text: '' })
    setTimeout(() => window.print(), 300)
  }

  return (
    <section className="panel tables-panel">
      <div className="box">
        <h3>Stolovi</h3>
        <p className="muted">
          Svaki sto dobija svoj QR kod. Sve fotografije idu u istu galeriju, a uz svaku piše s kojeg je stola.
          Stolove možete mijenjati bilo kada – već poslane fotografije zadržavaju oznaku pod kojom su poslane.
          Ako promijenite <strong>oznaku u linku</strong>, već odštampani QR za taj sto više neće prepoznavati sto (slanje i dalje radi).
        </p>
        <div className="generate">
          <label>Broj stolova <input type="number" min="1" max="200" value={count} onChange={(e) => setCount(e.target.value)} /></label>
          <label>Naziv <input type="text" value={prefix} maxLength={20} onChange={(e) => setPrefix(e.target.value)} /></label>
          <button type="button" className="btn btn-ghost btn-small" onClick={generate}>Napravi spisak</button>
        </div>
        <ul className="table-rows">
          {rows.map((r, i) => (
            <li key={i} className="table-row">
              <input type="text" aria-label="Naziv stola" value={r.label} maxLength={40} onChange={(e) => update(i, 'label', e.target.value)} placeholder="npr. Sto 7 ili Mladenački sto" />
              <input type="text" aria-label="Oznaka u linku" className="table-id" value={r.id} maxLength={20} onChange={(e) => update(i, 'id', slug(e.target.value) || e.target.value.toLowerCase())} />
              <button type="button" className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Ukloni ${r.label}`}><IconTrash width={18} height={18} /></button>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setRows([...rows, { id: '', label: '', _new: true }])}><IconPlus width={16} height={16} /> Dodaj sto</button>
          <button type="button" className="btn btn-gold" onClick={save} disabled={!dirty || state.busy}>Spremi stolove</button>
        </div>
      </div>

      <div className="box">
        <h3>QR kartice za štampu</h3>
        <p className="muted">Adresa stranice: <strong>{base}</strong></p>
        {temporary && <p className="notice notice-error">Ovo je privremena adresa. Kartice za štampu napravite tek s konačne javne adrese (postavite VITE_PUBLIC_SITE_URL ili otvorite admin na konačnoj adresi).</p>}
        {dirty && <p className="notice notice-error">Prvo spremite izmjene stolova.</p>}
        <div className="actions">
          <button className="btn btn-gold" disabled={state.busy || dirty} onClick={print}>Štampaj sve kartice (A4, 4 po stranici)</button>
          <button className="btn btn-ghost" disabled={state.busy || dirty} onClick={downloadAll} data-testid="qr-zip"><IconDownload width={18} height={18} /> Sve kartice (ZIP, PNG 300 dpi)</button>
        </div>
        <ul className="qr-grid">
          {allCards().map((card) => (
            <li key={card.url} className="qr-item" data-testid="qr-item">
              <QrThumb url={card.url} />
              <strong>{card.label || 'Opšti QR (bez stola)'}</strong>
              <span className="qr-url">{card.url}</span>
              <button className="btn btn-ghost btn-small" disabled={dirty} onClick={() => downloadOne(card)}>PNG</button>
            </li>
          ))}
        </ul>
      </div>
      {state.text && <p className={`notice notice-${state.type}`} role="status">{state.text}</p>}

      <div className="print-sheet" aria-hidden="true">
        {printCards.map((src, i) => <img key={i} src={src} alt="" />)}
      </div>
    </section>
  )
}
