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
// Dugme „OTVORI LOKACIJU“ otvara Google Maps (aplikaciju na iPhoneu/Androidu ako je instalirana),
// odakle gost jednim dodirom pokreće navigaciju. Redoslijed prednosti:
//   1. mapsLink – Google Maps link koji pošalju mladenci (Podijeli → Kopiraj link, npr. https://maps.app.goo.gl/...)
//   2. coords   – tačne koordinate, npr. '44.1234,18.1234'
//   3. query    – pretraga po tačnom nazivu/adresi koju su dali mladenci (privremeno, dok link ne stigne)
// Ništa od ovoga nije izmišljeno: dok link/koordinate nisu potvrđeni, polja ostaju prazna.
export const PROGRAM = [
  {
    id: 'mladozenja',
    time: '12:00',
    title: 'Okupljanje kod mladoženje',
    place: 'Slijevnice',
    icon: 'groom',
    highlight: true,
    query: 'Slijevnice, Kakanj',
    mapsLink: 'https://maps.app.goo.gl/yBX3s8W2CNhYZzsz6?g_st=ic', // ✔ link poslali mladenci
    coords: '',
  },
  {
    id: 'mlada',
    time: '12:00',
    title: 'Okupljanje kod mlade',
    place: 'Branilaca 10, Kakanj',
    icon: 'bride',
    query: 'Branilaca 10, 72240 Kakanj',
    mapsLink: '', // ⚠ preporučeno: Google Maps link kuće mlade
    coords: '',
  },
  {
    id: 'gradjansko',
    time: '15:00',
    title: 'Građansko vjenčanje',
    place: 'Općina Kakanj',
    icon: 'rings',
    query: 'Općina Kakanj, Ulica branilaca 1, 72240 Kakanj',
    mapsLink: '',
    coords: '',
  },
  {
    id: 'serijatsko',
    time: '16:00',
    title: 'Šerijatsko vjenčanje',
    place: 'Džamija Bičer, Željeznička Stanica, Kakanj',
    icon: 'mosque',
    query: 'Džamija Bičer, Željeznička Stanica, Kakanj',
    mapsLink: 'https://maps.app.goo.gl/s8cmAxsGuRx885kJ8?g_st=ic', // ✔ link poslali mladenci
    coords: '',
  },
  {
    id: 'slavlje',
    time: '18:00',
    title: 'Svadbeno slavlje',
    place: 'ADS Caffe & Restaurant',
    icon: 'cheers',
    query: 'ADS Caffe & Restaurant, Kakanj',
    mapsLink: '', // ⚠ preporučeno: Google Maps link restorana
    coords: '',
  },
]

// Zvanični Google Maps URL (radi u pregledniku i otvara aplikaciju Google Maps na mobitelu).
export const mapsUrl = ({ mapsLink, query, coords }) => {
  if (mapsLink && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)/.test(mapsLink)) return mapsLink
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords || query)}`
}

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
