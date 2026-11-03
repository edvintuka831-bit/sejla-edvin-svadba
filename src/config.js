// VERZIJA C – gosti kod mladoženje. Svi podaci pozivnice su na jednom mjestu.

export const COUPLE = { bride: 'Šejla', groom: 'Edvin', initials: 'Š & E' }

// Odbrojavanje do okupljanja: 23.01.2027. u 11:00 po vremenu Bosne i Hercegovine (Europe/Sarajevo).
// U januaru BiH koristi CET (UTC+01:00), pa je ovo tačan trenutak bez obzira na zonu telefona gosta.
export const GATHERING_DATE = new Date('2027-01-23T11:00:00+01:00')

export const DATE_TEXT = {
  weekday: 'SUBOTA',
  long: '23. JANUAR 2027.',
  short: '23.01.2027.',
  rsvpDeadline: '02.01.2027.',
}

export const INVITATION_TEXT = {
  greeting: 'Dragi naši,',
  paragraphs: [
    'S velikom radošću i ljubavlju pozivamo vas da budete dio našeg najljepšeg dana.',
    'Pozivamo vas da nam se pridružite na okupljanju kod mladoženje, odakle ćemo zajedno krenuti po našu mladu Šejlu.',
    'Vaše prisustvo učinit će ovaj poseban dan još ljepšim i nezaboravnijim.',
  ],
  closing: 'Radujemo se što ćete biti dio naše sreće!',
}

// Program dana (Verzija C)
export const PROGRAM = [
  { time: '11:00', title: 'Okupljanje kod mladoženje', place: 'Slijevnice', icon: 'groom' },
  { time: null, title: 'Zajednički odlazak po mladu', place: 'Krećemo zajedno po našu Šejlu', icon: 'car' },
  { time: '18:00', title: 'Svadbeno slavlje', place: 'ADS Caffe & Restaurant', icon: 'cheers' },
]

// Navigacija (Google Maps).
// ⚠ OKUPLJANJE: tačan pin kuće u Slijevnicama još nije dostavljen.
//   Kada ga dobijete, upišite koordinate u `coords` (npr. '44.1234,18.1234') – one imaju prednost nad pretragom.
// ⚠ RESTORAN: Google Maps pretraga po nazivu "ADS Caffe & Restoran, Kakanj" – provjerite da otvara pravi objekat.
export const LOCATIONS = {
  gathering: {
    label: 'Lokacija okupljanja',
    name: 'Slijevnice',
    detail: 'Okupljanje kod mladoženje · 11:00',
    query: 'Slijevnice, Kakanj',
    coords: '',
  },
  restaurant: {
    label: 'Lokacija restorana',
    name: 'ADS Caffe & Restaurant',
    detail: 'Svadbeno slavlje · 18:00',
    query: 'ADS Caffe & Restoran, Kakanj',
    coords: '',
  },
}

export const mapsUrl = ({ query, coords }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords || query)}`

// Muzika: Zdravko Čolić – Jedina (fajl public/audio/jedina.mp3, dostavljen od mladenaca).
export const MUSIC = {
  sources: ['/audio/jedina.mp3', '/audio/jedina.m4a'],
  title: 'Zdravko Čolić – Jedina',
  volume: 0.4,
}

export const CONTACTS = [
  { id: 'edvin', name: 'Edvin', phone: '+387644107473' },
  { id: 'sejla', name: 'Šejla', phone: '+387603292251' },
]
