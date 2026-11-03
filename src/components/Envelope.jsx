import { useEffect, useRef, useState } from 'react'
import { COUPLE, DATE_TEXT } from '../config.js'
import { FloralCorner, WaxSeal } from './Ornaments.jsx'

// Elegantna bijela koverta sa zlatnim detaljima.
// Faze: closed → seal (pečat se odvaja) → flap (preklop se otvara)
//       → letter (pozivnica izlazi) → leave (prijelaz u 3D scenu)
const TIMINGS = { seal: 650, flap: 950, letter: 1500, leave: 1000 }

export default function Envelope({ onOpen, onDone }) {
  const [stage, setStage] = useState('closed')
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const open = () => {
    if (stage !== 'closed') return
    onOpen?.() // muzika se mora pokrenuti direktno iz dodira
    const k = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.4 : 1
    let t = 0
    const at = (ms, fn) => timers.current.push(setTimeout(fn, (t += ms * k)))
    setStage('seal')
    at(TIMINGS.seal, () => setStage('flap'))
    at(TIMINGS.flap, () => setStage('letter'))
    at(TIMINGS.letter, () => setStage('leave'))
    at(TIMINGS.leave, () => onDone?.())
  }

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  return (
    <div className={`env-screen stage-${stage}`}>
      <div className="env-light" aria-hidden="true" />
      <FloralCorner className="corner tl" />
      <FloralCorner className="corner br" />

      <div
        className="envelope"
        role="button"
        tabIndex={0}
        aria-label="Dodirnite da otvorite pozivnicu"
        onClick={open}
        onKeyDown={onKey}
      >
        <div className="env-back" />
        <div className="env-letter" aria-hidden="true">
          <p className="letter-eyebrow">Pozivnica</p>
          <p className="letter-names">{COUPLE.bride} <i>&amp;</i> {COUPLE.groom}</p>
          <p className="letter-date">{DATE_TEXT.short}</p>
        </div>
        <div className="env-pocket" aria-hidden="true">
          <span className="pocket-l" />
          <span className="pocket-r" />
          <span className="pocket-b" />
        </div>
        <div className="env-front" aria-hidden="true">
          <p className="env-names">{COUPLE.bride} <i>&amp;</i> {COUPLE.groom}</p>
          <span className="env-rule" />
          <p className="env-date">{DATE_TEXT.short}</p>
        </div>
        <div className="env-flap" aria-hidden="true"><span /></div>
        <div className="seal" aria-hidden="true">
          <span className="seal-glow" />
          <WaxSeal initials={COUPLE.initials} />
        </div>
      </div>

      <p className="env-hint">Dodirnite da otvorite pozivnicu.</p>
    </div>
  )
}
