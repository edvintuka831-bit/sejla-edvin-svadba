import { useEffect, useState } from 'react'
import Upload from './Upload.jsx'
import Wish from './Wish.jsx'
import Gallery from './Gallery.jsx'
import PrivacyDialog from './Privacy.jsx'
import { Flourish, Monogram, Petals } from '../components/Ornaments.jsx'
import { IconCamera, IconGallery, IconHeart, IconShield } from '../components/Icons.jsx'
import { DEFAULT_LIMITS, IS_CONFIGURED, WEDDING } from '../lib/config.js'
import { getLimits } from '../lib/api.js'

function useStoredName() {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('se-guest-name') || ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('se-guest-name', name)
    } catch {
      /* privatni način rada */
    }
  }, [name])
  return [name, setName]
}

function Section({ id, eyebrow, title, children, intro }) {
  return (
    <section id={id} className="section reveal">
      <div className="card">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <Flourish />
        {intro && <p className="intro">{intro}</p>}
        {children}
      </div>
    </section>
  )
}

export default function GuestApp() {
  const [limits, setLimits] = useState(DEFAULT_LIMITS)
  const [privacy, setPrivacy] = useState(false)
  const [guestName, setGuestName] = useStoredName()

  useEffect(() => {
    getLimits().then((l) => l && setLimits((d) => ({ ...d, ...l })))
  }, [])

  // nježno pojavljivanje sekcija pri pomjeranju
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('in'))
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
      { threshold: 0.08 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const openPrivacy = () => setPrivacy(true)

  return (
    <>
      <Petals />
      <header className="hero">
        <Monogram />
        <p className="eyebrow fade-1">Wedding Memories</p>
        <h1 className="names fade-2">
          <span>{WEDDING.bride}</span>
          <em>&amp;</em>
          <span>{WEDDING.groom}</span>
        </h1>
        <Flourish className="fade-3" />
        <p className="date fade-3">{WEDDING.dateLabel}</p>
        <p className="venue fade-4">{WEDDING.venue}</p>
        <p className="hero-text fade-4">
          Hvala Vam što ste dio našeg dana. Podijelite s nama trenutke koje ste uhvatili –
          svaka fotografija, video i lijepa riječ postat će dio naše zajedničke uspomene.
        </p>
        <nav className="hero-nav fade-5" aria-label="Brze radnje">
          <a href="#posalji" className="btn btn-gold"><IconCamera width={20} height={20} /> Dodaj fotografije</a>
          <a href="#cestitka" className="btn btn-outline"><IconHeart width={20} height={20} /> Napiši čestitku</a>
          <a href="#galerija" className="btn btn-outline"><IconGallery width={20} height={20} /> Galerija</a>
        </nav>
      </header>

      <main>
        {!IS_CONFIGURED && (
          <p className="notice notice-error setup-warning" role="alert">
            Stranica još nije povezana sa Supabaseom (nedostaju VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY). Pogledajte README.
          </p>
        )}

        <Section
          id="posalji"
          eyebrow="Podijelite trenutak"
          title="Pošaljite fotografije i videozapise"
          intro="Bez registracije. Izaberite više datoteka odjednom – mladenci će ih pregledati prije objave u galeriji."
        >
          <Upload limits={limits} onOpenPrivacy={openPrivacy} guestName={guestName} setGuestName={setGuestName} />
        </Section>

        <Section id="cestitka" eyebrow="Od srca" title="Čestitka mladencima" intro="Napišite nekoliko riječi Šejli i Edvinu.">
          <Wish onOpenPrivacy={openPrivacy} guestName={guestName} setGuestName={setGuestName} />
        </Section>

        <section id="galerija" className="section section-wide reveal">
          <div className="section-head">
            <p className="eyebrow">Naše uspomene</p>
            <h2>Galerija</h2>
            <Flourish />
            <p className="intro">Ovdje se prikazuju samo fotografije, videozapisi i čestitke koje su mladenci odobrili.</p>
          </div>
          <Gallery />
        </section>
      </main>

      <footer className="footer">
        <button type="button" className="privacy-link" onClick={openPrivacy}>
          <IconShield width={18} height={18} /> Obavijest o privatnosti
        </button>
        <p className="footer-names">{WEDDING.bride} &amp; {WEDDING.groom}</p>
        <p>{WEDDING.dateLong} · {WEDDING.venue}</p>
      </footer>

      <PrivacyDialog open={privacy} onClose={() => setPrivacy(false)} />
    </>
  )
}
