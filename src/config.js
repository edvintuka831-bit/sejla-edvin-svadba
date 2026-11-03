// VERZIJA C – gosti kod mladoženje. Svi podaci pozivnice su na jednom mjestu.

export const COUPLE = { bride: 'Šejla', groom: 'Edvin', initials: 'Š & E' }

// Odbrojavanje do okupljanja: 23.01.2027. u 12:00 po vremenu Bosne i Hercegovine (Europe/Sarajevo).
// U januaru BiH koristi CET (UTC+01:00), pa je ovo tačan trenutak bez obzira na zonu telefona gosta.
export const GATHERING_DATE = new Date('2027-01-23T12:00:00+01:00')

export const DATE_TEXT = {
  weekday: 'SUBOTA',
  long: '23. JANUAR 2027.',
  short: '23.01.2027.',
  rsvpDeadline: '02.01.2027.',
}

export const GUEST_CATEGORY = 'GOSTI KOD MLADOŽENJE'

export const INVITATION_TEXT = {
  greeting: 'Dragi naši,',
  paragraphs: [
    'S velikom ljubavlju i radošću pozivamo Vas da budete dio našeg najljepšeg dana.',
    'Pozivamo Vas da nam se pridružite na okupljanju kod mladoženje Edvina, odakle ćemo zajedno krenuti po našu mladu Šejlu.',
    'Vaše prisustvo učinit će ove posebne trenutke još ljepšim, a našu sreću još većom.',
  ],
  closing: 'Radujemo se Vašem dolasku i zajedničkom slavlju!',
}

// Program dana. Vrijeme polaska po mladu namjerno NIJE navedeno (nije dogovoreno).
// Navigacija (Google Maps): `coords` (npr. '44.1234,18.1234') ima prednost nad pretragom `query`.
// ⚠ Slijevnice: tačan pin kuće još nije dostavljen – pretraga vodi do naselja.
// ⚠ ADS Caffe & Restaurant i Džamija Bičer: pretraga po nazivu – provjeriti / poslati pin.
export const PROGRAM = [
  {
    id: 'mladozenja',
    time: '12:00',
    title: 'Okupljanje kod mladoženje',
    place: 'Slijevnice',
    icon: 'groom',
    highlight: true,
    query: 'Slijevnice, Kakanj',
    coords: '',
  },
  {
    id: 'mlada',
    time: '12:00',
    title: 'Okupljanje kod mlade',
    place: 'Branilaca 10',
    icon: 'bride',
    query: 'Ulica branilaca 10, 72240 Kakanj',
    coords: '',
  },
  {
    id: 'gradjansko',
    time: '15:00',
    title: 'Građansko vjenčanje',
    place: 'Općina Kakanj',
    icon: 'rings',
    query: 'Općina Kakanj, Ulica branilaca 1, 72240 Kakanj',
    coords: '',
  },
  {
    id: 'serijatsko',
    time: '16:00',
    title: 'Šerijatsko vjenčanje',
    place: 'Džamija Bičer, Željeznička Stanica',
    icon: 'mosque',
    query: 'Džamija Bičer, Kakanj',
    coords: '',
  },
  {
    id: 'slavlje',
    time: '18:00',
    title: 'Svadbeno slavlje',
    place: 'ADS Caffe & Restaurant',
    icon: 'cheers',
    query: 'ADS Caffe & Restoran, Kakanj',
    coords: '',
  },
]

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
