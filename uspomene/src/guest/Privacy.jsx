import { useEffect, useRef } from 'react'
import { IconClose, IconShield } from '../components/Icons.jsx'
import { WEDDING } from '../lib/config.js'

export function PrivacyText() {
  return (
    <div className="privacy-text">
      <p>
        Ova stranica služi isključivo da gosti vjenčanja Šejle i Edvina ({WEDDING.dateLabel},{' '}
        {WEDDING.venue}) podijele fotografije, videozapise i čestitke s mladencima.
      </p>
      <h4>Šta se prikuplja</h4>
      <ul>
        <li>datoteke koje pošaljete (fotografije i videozapisi), ime koje upišete (nije obavezno uz fotografije), oznaku stola iz QR koda i čestitke;</li>
        <li>vrijeme slanja. IP adresa se <strong>ne sprema</strong> – koristi se samo jednosmjerni sažetak radi zaštite od masovnog slanja, koji se briše nakon nekoliko dana.</li>
      </ul>
      <h4>Ko vidi sadržaj</h4>
      <ul>
        <li>Sve što pošaljete prvo vide <strong>samo mladenci</strong> (administratori). Do odobrenja se čuva u privatnom prostoru.</li>
        <li>Tek nakon odobrenja sadržaj postaje vidljiv u galeriji svima koji imaju link ove stranice (gosti s QR kodom). Stranica nije namijenjena pretraživačima.</li>
        <li>U javnoj galeriji prikazuje se umanjena kopija fotografije <strong>bez skrivenih podataka</strong> (lokacija/GPS, model telefona). Originali ostaju privatni i dostupni samo mladencima.</li>
        <li>Videozapisi se objavljuju u obliku u kojem su poslani (mogu sadržavati podatke koje je telefon upisao, npr. lokaciju snimanja).</li>
      </ul>
      <h4>Vaša saglasnost i odgovornost</h4>
      <ul>
        <li>Šaljite samo sadržaj koji ste sami snimili i za koji se osobe na njemu slažu s objavom. Ne šaljite fotografije djece bez saglasnosti roditelja.</li>
        <li>Mladenci mogu bilo koji sadržaj odbiti ili obrisati bez obrazloženja.</li>
        <li>Ako želite da se nešto što ste poslali ili na čemu se nalazite ukloni, javite se direktno mladencima – sadržaj će biti obrisan iz galerije i iz arhive.</li>
      </ul>
      <h4>Čuvanje</h4>
      <p>
        Datoteke se čuvaju u privatnoj pohrani Cloudflare R2 (EU), a stranica i spisak poslanog na Netlifyju. Odobreni sadržaj se
        prikazuje samo preko vremenski ograničenih linkova. Mladenci mogu preuzeti originale za lični album; nakon toga se galerija
        gasi i sadržaj briše.
      </p>
    </div>
  )
}

export default function PrivacyDialog({ open, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="privacy-title">
      <div className="sheet-inner">
        <button className="sheet-close" type="button" onClick={onClose} aria-label="Zatvori">
          <IconClose />
        </button>
        <div className="sheet-icon"><IconShield /></div>
        <h3 id="privacy-title">Obavijest o privatnosti</h3>
        <PrivacyText />
        <button className="btn btn-gold" type="button" onClick={onClose}>Razumijem</button>
      </div>
    </dialog>
  )
}
