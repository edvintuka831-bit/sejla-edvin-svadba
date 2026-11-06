import { useEffect, useState } from 'react'
import { formatBytes } from '../lib/format.js'
import { IconCheck, IconAlert, IconRefresh } from '../components/Icons.jsx'
import { adminGet } from './adminApi.js'

// Provjera prije objave: podešavanja, privatnost pohrane, prostor i procjena troška
export default function SystemPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = () => {
    setData(null)
    setError('')
    adminGet('system').then(setData).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  return (
    <section className="panel box system-panel">
      <div className="panel-bar">
        <h3>Provjera sistema</h3>
        <button className="icon-btn" onClick={load} aria-label="Ponovi provjeru"><IconRefresh width={20} height={20} /></button>
      </div>
      {error && <p className="notice notice-error">{error}</p>}
      {!data && !error && <div className="panel-empty"><span className="spinner dark" /></div>}
      {data && (
        <>
          <ul className="checks" data-testid="checks">
            {data.checks.map((c) => (
              <li key={c.name} className={c.ok ? 'ok' : 'bad'}>
                {c.ok ? <IconCheck width={20} height={20} /> : <IconAlert width={20} height={20} />}
                <span><strong>{c.name}</strong><small>{c.detail}</small></span>
              </li>
            ))}
          </ul>
          <h4>Prostor i trošak (Cloudflare R2)</h4>
          <p>
            Zauzeto: <strong>{formatBytes(data.usage.bytes)}</strong> ({data.usage.files} datoteka) · besplatno: {data.cost.freeGB} GB ·
            ograničenje aplikacije: {data.limits.storageLimitGB} GB
          </p>
          <p>
            Procjena mjesečnog troška pohrane: <strong data-testid="cost">{data.cost.estimatedMonthlyUSD.toFixed(2)} $</strong>
            {' '}(0,015 $ po GB iznad 10 GB; pregledi i preuzimanja se ne naplaćuju).
          </p>
          <h4>Ograničenja za goste</h4>
          <p>
            Fotografija do {data.limits.maxImageMB} MB · video do {data.limits.maxVideoMB} MB · najviše {data.limits.maxFilesPerHour} datoteka
            na sat i {data.limits.maxFilesPerDay} na dan po uređaju.
          </p>
          <p className="muted">
            Netlify: fotografije i videi ne prolaze kroz Netlify, pa se njegov besplatni saobraćaj troši samo na samu stranicu.
            Svaka nova objava (deploy) troši oko 15 od 300 mjesečnih kredita – pred svadbu objavljujte samo kad je potrebno.
          </p>
        </>
      )}
    </section>
  )
}
