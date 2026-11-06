import { useState } from 'react'
import { downloadZip } from 'client-zip'
import { formatBytes, formatDate } from '../lib/format.js'
import { IconDownload } from '../components/Icons.jsx'
import { adminGet, safeName } from './adminApi.js'

// Telefoni drže cijelu arhivu u memoriji prije snimanja – zato se dijeli na dijelove.
const canStreamToDisk = typeof window !== 'undefined' && 'showSaveFilePicker' in window
const PART_BYTES = canStreamToDisk ? 4 * 1024 ** 3 : 700 * 1024 ** 2

const STATUS_DIR = { approved: 'odobreno', pending: 'na-cekanju', rejected: 'odbijeno' }

// Spisak svih originala s linkovima za preuzimanje (linkovi važe 6 sati)
async function fetchExport(scope) {
  const items = []
  let wishes = []
  for (let offset = 0; ; offset += 150) {
    const page = await adminGet(`export?scope=${scope}&offset=${offset}`)
    items.push(...page.items)
    if (page.wishes) wishes = page.wishes
    if (!page.more) return { items, wishes }
  }
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function wishesFiles(wishes) {
  const csv =
    '﻿Ime;Čestitka;Status;Poslano\n' +
    wishes.map((w) => [w.guestName, w.tableLabel || '', w.message, w.status, formatDate(w.createdAt)].map(csvCell).join(';')).join('\n')
  const txt = wishes
    .map((w) => `${w.guestName}${w.tableLabel ? ` · ${w.tableLabel}` : ''} (${formatDate(w.createdAt)})\n${w.message}\n`)
    .join('\n— — —\n\n')
  return [
    { name: 'cestitke/cestitke.csv', input: csv },
    { name: 'cestitke/cestitke.txt', input: txt || 'Nema čestitki.' },
  ]
}

function planParts(rows) {
  const parts = []
  let current = []
  let size = 0
  for (const r of rows) {
    if (current.length && size + Number(r.size) > PART_BYTES) {
      parts.push(current)
      current = []
      size = 0
    }
    current.push(r)
    size += Number(r.size)
  }
  if (current.length) parts.push(current)
  return parts
}

export default function DownloadPanel() {
  const [scope, setScope] = useState('approved')
  const [plan, setPlan] = useState(null)
  const [state, setState] = useState({ busy: false, text: '', type: 'info' })

  async function prepare() {
    setState({ busy: true, text: 'Priprema spiska datoteka…', type: 'info' })
    try {
      const { items: media, wishes } = await fetchExport(scope)
      setPlan({ parts: planParts(media), wishes, total: media.reduce((s, m) => s + Number(m.size), 0), count: media.length, at: Date.now() })
      setState({ busy: false, text: '', type: 'info' })
    } catch (e) {
      setState({ busy: false, text: e.message, type: 'error' })
    }
  }

  async function downloadPart(index) {
    const rows = plan.parts[index] || []
    const label = `${index + 1}/${Math.max(1, plan.parts.length)}`
    const fileName = `Sejla-Edvin-uspomene${scope === 'approved' ? '' : '-sve'}${plan.parts.length > 1 ? `-dio-${index + 1}` : ''}.zip`
    let handle = null
    if (canStreamToDisk) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'ZIP arhiva', accept: { 'application/zip': ['.zip'] } }] })
      } catch {
        return // korisnik je odustao
      }
    }
    if (Date.now() - plan.at > 5 * 3600_000) {
      setPlan(null)
      setState({ busy: false, type: 'error', text: 'Linkovi su istekli – kliknite ponovo „Pripremi arhivu“.' })
      return
    }
    setState({ busy: true, text: `Dio ${label}: priprema…`, type: 'info' })
    try {
      const totalBytes = rows.reduce((s, r) => s + Number(r.size), 0)
      let loaded = 0
      let doneFiles = 0
      const used = new Set()
      const failed = []
      const report = () =>
        setState({
          busy: true,
          type: 'info',
          text: `Dio ${label}: ${doneFiles} / ${rows.length} datoteka · ${formatBytes(loaded)} od ${formatBytes(totalBytes)}`,
        })

      async function* entries() {
        if (index === 0) yield* wishesFiles(plan.wishes)
        let n = 0
        for (const r of rows) {
          n++
          const dir = `${scope === 'approved' ? '' : `${STATUS_DIR[r.status]}/`}${r.kind === 'video' ? 'videozapisi' : 'fotografije'}`
          let name = `${dir}/${String(n + index * 10000).padStart(4, '0')}_${r.filename}`
          if (used.has(name)) name = name.replace(/(\.[^.]+)$/, `_${r.id.slice(-6)}$1`)
          used.add(name)
          // do 3 pokušaja po datoteci (slaba mreža na telefonu)
          let res = null
          for (let attempt = 0; attempt < 3 && !res?.ok; attempt++) {
            if (attempt) await new Promise((w) => setTimeout(w, 1500 * attempt))
            res = await fetch(r.url, { cache: 'no-store' }).catch((e) => {
              console.warn('arhiva', r.originalName, e?.message)
              return null
            })
            if (res && !res.ok) console.warn('arhiva', r.originalName, res.status)
          }
          if (!res?.ok) {
            failed.push(r.originalName)
            continue
          }
          const counter = new TransformStream({
            transform(chunk, ctrl) {
              loaded += chunk.byteLength
              ctrl.enqueue(chunk)
            },
            flush() {
              doneFiles++
              report()
            },
          })
          yield { name, lastModified: new Date(r.createdAt), input: res.body.pipeThrough(counter), size: Number(r.size) }
        }
        if (failed.length) yield { name: 'NIJE-PREUZETO.txt', input: `Ove datoteke nije bilo moguće preuzeti:\n${failed.join('\n')}` }
      }

      report()
      const zip = downloadZip(entries())
      if (handle) {
        const writable = await handle.createWritable()
        await zip.body.pipeTo(writable)
      } else {
        const blob = await zip.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.append(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
      setState({
        busy: false,
        type: failed.length ? 'error' : 'success',
        text: failed.length
          ? `Dio ${label} preuzet, ali ${failed.length} datoteka nije uspjelo (spisak je u arhivi). Pokušajte ponovo.`
          : `Dio ${label} je preuzet (${doneFiles} datoteka).`,
      })
    } catch (e) {
      console.error(e)
      setState({ busy: false, type: 'error', text: `Preuzimanje nije uspjelo: ${e.message}` })
    }
  }

  return (
    <section className="panel download-panel">
      <h3>Preuzimanje originala</h3>
      <p className="muted">
        Arhiva sadrži <strong>originalne datoteke</strong> (pune kvalitete, kakve su gosti poslali) i sve čestitke (CSV za Excel i TXT).
        {canStreamToDisk
          ? ' Ovaj preglednik snima arhivu direktno na disk.'
          : ' Na telefonu se velika arhiva dijeli na dijelove do 700 MB. Za jednu veliku arhivu koristite Chrome ili Edge na računaru.'}
      </p>
      <div className="segmented">
        <button className={scope === 'approved' ? 'active' : ''} onClick={() => { setScope('approved'); setPlan(null) }}>Samo odobreno</button>
        <button className={scope === 'all' ? 'active' : ''} onClick={() => { setScope('all'); setPlan(null) }}>Sve (i na čekanju/odbijeno)</button>
      </div>
      {!plan && (
        <button className="btn btn-gold" onClick={prepare} disabled={state.busy}>
          {state.busy ? <><span className="spinner" /> Priprema…</> : 'Pripremi arhivu'}
        </button>
      )}
      {plan && (
        <>
          <p>
            <strong>{plan.count}</strong> datoteka · {formatBytes(plan.total)} · {plan.wishes.length} čestitki
          </p>
          <div className="parts">
            {plan.parts.length === 0 && (
              <button className="btn btn-gold" disabled={state.busy} onClick={() => downloadPart(0)}>
                <IconDownload width={18} height={18} /> Preuzmi čestitke (ZIP)
              </button>
            )}
            {plan.parts.map((p, i) => (
              <button key={i} className="btn btn-gold" disabled={state.busy} onClick={() => downloadPart(i)} data-testid="download-part">
                <IconDownload width={18} height={18} />
                {plan.parts.length > 1 ? `Dio ${i + 1}: ` : 'Preuzmi arhivu: '}
                {p.length} datoteka · {formatBytes(p.reduce((s, r) => s + Number(r.size), 0))}
              </button>
            ))}
          </div>
        </>
      )}
      {state.text && <p className={`notice notice-${state.type}`} role="status" data-testid="download-status">{state.text}</p>}
    </section>
  )
}
