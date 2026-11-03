import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Countdown from './components/Countdown.jsx'
import Envelope from './components/Envelope.jsx'
import Icon from './components/Icons.jsx'
import MusicControls from './components/MusicButton.jsx'
import { Divider, OrnamentDefs } from './components/Ornaments.jsx'
import Rsvp from './components/Rsvp.jsx'
import { COUPLE, DATE_TEXT, INVITATION_TEXT, LOCATIONS, mapsUrl, PROGRAM } from './config.js'
import { useMusic } from './hooks/useMusic.js'
import { detectTier, hasWebGL, sceneState } from './three/state.js'

// 3D scena se učitava odmah u pozadini (dok gost gleda kovertu), u zasebnom paketu.
const scenePromise = import('./three/Scene.jsx')
const Scene = lazy(() => scenePromise)

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    console.warn('3D scena nije dostupna, prikazuje se statična pozadina.', err)
    this.props.onFail?.()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// Sekcije se nježno pojavljuju pri skrolanju.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.15 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function Invitation() {
  useReveal()
  return (
    <main className="invitation">
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-eyebrow">Pozivnica · gosti kod mladoženje</p>
          <h1 className="hero-names">
            <span>{COUPLE.bride}</span>
            <i>&amp;</i>
            <span>{COUPLE.groom}</span>
          </h1>
          <p className="hero-date">{DATE_TEXT.weekday}, {DATE_TEXT.long}</p>
        </div>
        <a className="scroll-cue" href="#poziv" aria-label="Pomjerite prema dolje">
          <span />
        </a>
      </section>

      <div className="gap" />

      <section className="panel" id="poziv">
        <div className="card reveal">
          <p className="script-greeting">{INVITATION_TEXT.greeting}</p>
          {INVITATION_TEXT.paragraphs.map((t) => (
            <p key={t} className="lead">{t}</p>
          ))}
          <Divider />
          <p className="sign">{COUPLE.bride} &amp; {COUPLE.groom}</p>
        </div>
      </section>

      <div className="gap" />

      <section className="panel" id="program">
        <div className="card reveal">
          <p className="eyebrow">Program dana</p>
          <h2 className="section-title">{DATE_TEXT.weekday}, {DATE_TEXT.long}</h2>
          <Divider />
          <ol className="timeline">
            {PROGRAM.map((e) => (
              <li key={e.title} className={`tl-item ${e.time ? '' : 'tl-transit'}`}>
                <span className="tl-icon"><Icon name={e.icon} size={26} /></span>
                <div className="tl-body">
                  {e.time && <p className="tl-time">{e.time}</p>}
                  <p className="tl-title">{e.title}</p>
                  <p className="tl-place">{e.place}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="gap" />

      <section className="panel" id="odbrojavanje">
        <div className="card card-slim reveal">
          <p className="eyebrow">Do okupljanja je ostalo</p>
          <Countdown />
          <p className="small-note">23. januar 2027. u 11:00 · vrijeme u Bosni i Hercegovini</p>
        </div>
      </section>

      <div className="gap gap-sm" />

      <section className="panel" id="lokacije">
        <div className="card reveal">
          <p className="eyebrow">Navigacija</p>
          <h2 className="section-title">Kako do nas</h2>
          <Divider />
          <div className="nav-grid">
            {[LOCATIONS.gathering, LOCATIONS.restaurant].map((l) => (
              <a key={l.label} className="nav-btn" href={mapsUrl(l)} target="_blank" rel="noopener noreferrer">
                <span className="nav-icon"><Icon name="pin" size={24} /></span>
                <span className="nav-text">
                  <b>{l.label}</b>
                  <span>{l.name}</span>
                  <small>{l.detail}</small>
                </span>
                <Icon name="navigate" size={18} className="nav-arrow" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="gap gap-sm" />

      <section className="panel">
        <Rsvp />
      </section>

      <div className="gap" />

      <section className="panel finale">
        <div className="card reveal">
          <p className="finale-text">{INVITATION_TEXT.closing}</p>
          <Divider />
          <p className="finale-names">{COUPLE.bride} <i>&amp;</i> {COUPLE.groom}</p>
          <p className="small-note">{DATE_TEXT.short}</p>
        </div>
      </section>
      <div className="gap gap-end" />
    </main>
  )
}

export default function App() {
  const [opened, setOpened] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [webgl, setWebgl] = useState(true)
  const tier = useMemo(() => detectTier(), [])
  const music = useMusic()
  const raf = useRef(0)

  useEffect(() => {
    if (!hasWebGL()) setWebgl(false)
    document.documentElement.classList.add(`tier-${tier}`)
  }, [tier])

  useEffect(() => {
    document.body.classList.toggle('locked', !revealed)
  }, [revealed])

  // Napredak skrolanja → 3D kamera.
  useEffect(() => {
    if (!revealed) return
    const update = () => {
      raf.current = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      sceneState.progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
    }
    const onScroll = () => {
      if (!raf.current) raf.current = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [revealed])

  const handleOpen = () => {
    music.play()
    setOpened(true)
    sceneState.opened = true
    sceneState.openedAt = performance.now()
    window.scrollTo(0, 0)
  }

  return (
    <>
      <OrnamentDefs />
      <div className="bg-fallback" aria-hidden="true" />
      {webgl && (
        <div className={`scene ${opened ? 'is-live' : ''}`} aria-hidden="true">
          <SceneBoundary onFail={() => setWebgl(false)}>
            <Suspense fallback={null}>
              <Scene tier={tier} active={opened} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
      <div className="scene-veil" aria-hidden="true" />

      {revealed && <Invitation />}
      {!revealed && <Envelope onOpen={handleOpen} onDone={() => setRevealed(true)} />}
      {opened && <MusicControls music={music} />}
    </>
  )
}
