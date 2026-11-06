import { useState } from 'react'
import { downloadZip } from 'client-zip'
import { supabase } from '../lib/supabase.js'
import { formatBytes, formatDate } from '../lib/format.js'
import { IconDownload } from '../components/Icons.jsx'
import { MEDIA_COLUMNS, safeName, signMany } from './adminApi.js'

// Telefoni drže cijelu arhivu u memoriji prije snimanja – zato se dijeli na dijelove.
const canStreamToDisk = typeof window !== 'undefined' && 'showSaveFilePicker' in window
const PART_BYTES = canStreamToDisk ? 4 * 1024 ** 3 : 700 * 1024 ** 2

const STATUS_DIR = { approved: 'odobreno', pending: 'na-cekanju', rejected: 'odbijeno' }

async function fetchAll(table, columns, statuses) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in('status', statuses)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function wishesFiles(wishes) {
  const csv =
    '﻿Ime;Čestitka;Status;Poslano\n' +
    wishes.map((w) => [w.guest_name, w.message, w.status, formatDate(w.created_at)].map(csvCell).join(';')).join('\n')
  const txt = wishes
    .map((w) => `${w.guest_name} (${formatDate(w.created_at)})\n${w.message}\n`)
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
    if (current.length && size + Number(r.size_bytes) > PART_BYTES) {
      parts.push(current)
      current = []
      size = 0
    }
    current.push(r)
    size += Number(r.size_bytes)
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
      const statuses = scope === 'approved' ? ['approved'] : ['approved', 'pending', 'rejected']
      const media = await fetchAll('media', MEDIA_COLUMNS, statuses)
      const wishes = await fetchAll('wishes', 'id, guest_name, message, status, created_at', statuses)
      setPlan({ parts: planParts(media), wishes, total: media.reduce((s, m) => s + Number(m.size_bytes), 0), count: media.length })
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
    setState({ busy: true, text: `Dio ${label}: priprema linkova…`, type: 'info' })
    try {
      const urls = await signMany(rows.map((r) => r.original_path), 3 * 3600)
      const totalBytes = rows.reduce((s, r) => s + Number(r.size_bytes), 0)
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
          const ext = r.original_path.split('.').pop()
          let name = `${dir}/${String(n + index * 10000).padStart(4, '0')}_${safeName(r.guest_name, 30)}_${safeName(r.original_name.replace(/\.[^.]+$/, ''), 40)}.${ext}`
          if (used.has(name)) name = name.replace(`.${ext}`, `_${r.id.slice(0, 6)}.${ext}`)
          used.add(name)
          const res = await fetch(urls[r.original_path]).catch(() => null)
          if (!res?.ok) {
            failed.push(r.original_name)
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
          yield { name, lastModified: new Date(r.created_at), input: res.body.pipeThrough(counter), size: Number(r.size_bytes) }
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
                {p.length} datoteka · {formatBytes(p.reduce((s, r) => s + Number(r.size_bytes), 0))}
              </button>
            ))}
          </div>
        </>
      )}
      {state.text && <p className={`notice notice-${state.type}`} role="status" data-testid="download-status">{state.text}</p>}
    </section>
  )
}
