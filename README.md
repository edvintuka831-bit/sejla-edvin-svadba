# Šejla & Edvin – VERZIJA C · gosti kod mladoženje

Luksuzna 3D digitalna pozivnica za goste koji dolaze kod mladoženje Edvina, odakle svi zajedno idemo po mladu Šejlu.
Ovo je **zaseban projekat** (repozitorij `sejla-edvin-svadba`) i **zasebna Netlify stranica**.
Ranije pozivnice (repozitorij `Vjencanje-sejla-edvin`) nisu mijenjane i rade dalje na svojim adresama.

> **Novo:** `memories/` – zaseban projekat **Wedding Memories** (galerija fotografija, videa i čestitki gostiju sa moderacijom, Supabase + Netlify). Upute: [`memories/README.md`](memories/README.md).

## Šta pozivnica sadrži

| Dio | Opis |
|---|---|
| Koverta | Bijela koverta sa zlatnim detaljima i voštanim pečatom, natpis *Šejla & Edvin · 23.01.2027.* i *Dodirnite da otvorite pozivnicu.* Dodir otvara preklop, izvlači pozivnicu i pokreće muziku. |
| 3D scena (Three.js / React Three Fiber) | Bijeli svadbeni automobil u stalnoj vožnji (okreću se točkovi, buket ruža i satenske trake), aleja s kamenim lukovima, cvjetnim vijencima, lampionima i čempresima, zlatno svjetlo zalaska sunca, refleksije na kamenoj aleji, prave sjene, padajuće latice i zlatne iskre. Kamera se filmski kreće kroz 7 kadrova dok gost skrola, a na kraju auto stiže do rotonde – kuće mlade. Sve je modelirano u kodu, bez vanjskih 3D fajlova. |
| Tekst | Kompletan tekst pozivnice za Verziju C. |
| Program našeg posebnog dana | 12:00 okupljanje kod mladoženje (Slijevnice – istaknuto i na naslovnom ekranu) · 12:00 okupljanje kod mlade (Branilaca 10) · 15:00 građansko vjenčanje (Općina Kakanj) · 16:00 šerijatsko vjenčanje (Džamija Bičer, Željeznička Stanica) · 18:00 svadbeno slavlje (ADS Caffe & Restaurant). Svaki događaj ima dugme **Navigacija** (Google Maps). Vrijeme polaska po mladu namjerno nije navedeno. |
| Odbrojavanje | Do 23.01.2027. u 12:00 po vremenu BiH (Europe/Sarajevo) – dani, sati, minute, sekunde. Tačno bez obzira na vremensku zonu telefona. |
| Muzika | Zdravko Čolić – „Jedina“ (`public/audio/jedina.mp3`), kreće nakon dodira koverte (pravilo mobilnih preglednika), svira u petlji tokom cijelog pregleda, pauzira se kad gost napusti tab i nastavlja kad se vrati; zlatno dugme dolje desno uključuje/isključuje. |
| Potvrda dolaska | Ime i prezime, Dolazim / Ne mogu doći, broj osoba, napomena. Dugmad **Potvrdi dolazak · Edvin** (+387 64 410 7473) i **Potvrdi dolazak · Šejla** (+387 60 329 2251) otvaraju WhatsApp s gotovom porukom (ime, dolazak, broj osoba, napomena); gost samo dodirne **Pošalji**. Radi i kad je stranica objavljena prevlačenjem ZIP-a. Ako je stranica povezana s GitHubom, potvrda se dodatno tiho sprema i u bazu za admin pregled. |
| Admin | `/admin` – prijava šifrom, ukupan broj gostiju, broj potvrda, pregled odgovora, pretraga, filter, izmjena, brisanje, izvoz Excel i CSV (s kolonom Kategorija). |
| Dijeljenje | Naslov, opis i slika 1200×630 (`public/og-image.jpg`) za Viber, WhatsApp i Facebook. |

### Prilagođavanje uređajima
Automatski se bira kvalitet (telefon / tablet / računar): rezolucija, sjene, refleksije, broj latica.
Ako uređaj ne stiže, scena sama smanjuje kvalitet (animacija ostaje glatka). Bez WebGL-a prikazuje se
elegantna statična pozadina – pozivnica i forma rade normalno. Poštuje se „smanji pokrete“ u postavkama telefona.

## Potvrde dolaska – baza i sigurnost

Umjesto Supabasea koristi se **Netlify Blobs** – stvarna trajna baza ugrađena u Netlify. Prednost: nema dodatnog naloga, nema javnih API ključeva u kodu stranice, i radi čim se stranica poveže s GitHubom.


| Dio | Tehnologija |
|---|---|
| Baza | **Netlify Blobs** (trajna pohrana ugrađena u Netlify, spremište `rsvp-mladozenja`) – nema vanjskog naloga ni ključeva u kodu |
| Server | Netlify Functions: `netlify/functions/rsvp.mjs` (`/api/rsvp`), `netlify/functions/admin.mjs` (`/api/admin/*`) |
| Potvrda upisa | Server upiše zapis, **ponovo ga pročita iz baze** i tek onda vrati uspjeh. Gost vidi „Hvala“ samo tada; u svakom drugom slučaju vidi „Potvrda NIJE spremljena“. |
| Admin šifra | Netlify varijabla **`ADMIN_PASSWORD`** (min. 8 znakova) – nikad u kodu stranice |
| Zaštita | HttpOnly kolačić 7 dana; 5 pogrešnih šifri → zaključavanje 15 min; ograničenje slanja; skriveno polje protiv botova; admin `noindex` |

## ⚠ Lokacije – šta je provjereno, a šta trebam od vas

Svaki događaj ima zlatno dugme **OTVORI LOKACIJU** (visina 50 px, prilagođeno dodiru prstom). Dodir otvara
Google Maps – na iPhoneu/Androidu aplikaciju ako je instalirana, inače Google Maps u pregledniku – gdje gost
dodirne **Upute / Directions → Start** i navigacija počinje.

Lokacija se bira ovim redom (u `src/config.js`, lista `PROGRAM`):
1. `mapsLink` – **Google Maps link koji pošaljete** (u Google Maps: lokacija → *Podijeli* → *Kopiraj link*, npr. `https://maps.app.goo.gl/…`);
2. `coords` – koordinate, npr. `'44.1234,18.1234'`;
3. `query` – pretraga po tačnom nazivu/adresi koju ste dali (privremeno rješenje).

| Događaj | Trenutno otvara | Status |
|---|---|---|
| 12:00 Okupljanje kod mladoženje | Google Maps link mladenaca `https://maps.app.goo.gl/yBX3s8W2CNhYZzsz6` | ✔ link dostavljen |
| 12:00 Okupljanje kod mlade | pretraga `Branilaca 10, 72240 Kakanj` | Ulica branilaca postoji u Kakanju (dokumenti Općine). Kućni broj Google možda nema – **preporučen link** |
| 15:00 Građansko vjenčanje | pretraga `Općina Kakanj, Ulica branilaca 1, 72240 Kakanj` | ✔ adresa iz službenog dokumenta Općine Kakanj |
| 16:00 Šerijatsko vjenčanje | Google Maps link mladenaca `https://maps.app.goo.gl/s8cmAxsGuRx885kJ8` | ✔ link dostavljen |
| 18:00 Svadbeno slavlje | pretraga `ADS Caffe & Restaurant, Kakanj` | ⚠ objekat postoji u Kakanju, tačan pin nepotvrđen – **preporučen link** |

Koordinate nisu upisane namjerno: iz radnog okruženja Google Maps i OpenStreetMap nisu bili dostupni,
pa nijedna koordinata nije nagađana.

**Muzika** – koristi se `jedina.mp3` koji ste dostavili za prethodnu pozivnicu; pjesma nije mijenjana.
Prava javnog korištenja snimka su vaša odgovornost kao vlasnika pozivnice.

**Za fotorealističan 3D prikaz** – automobil, arhitektura i cvijeće su modelirani u kodu (bez vanjskih datoteka),
stil je elegantan ali stilizovan. Za izgled „kao u referentnom videu“ potrebno je:
1. licenciran 3D model bijelog luksuznog automobila u `.glb` formatu (npr. Sketchfab / CGTrader, komercijalna licenca, do ~5 MB),
2. po želji HDRI okruženje zlatnog sata (`.hdr`, 1–2K, npr. Poly Haven – besplatno, CC0),
3. referentni video ponovo (u ovoj sesiji nije dostupan) – da se uskladi kadar i boja.
Kada ih dostavite, ubacuju se u `src/three/Car.jsx` i `src/three/Scene.jsx` bez promjene ostatka pozivnice.

## Objava na Netlify – s Android tableta (preporučeno, sve radi)

> Potvrde dolaska i admin rade preko serverskih funkcija, a Netlify ih pokreće **samo kada je stranica
> povezana s GitHubom**. Ručno prevlačenje ZIP-a (Netlify Drop) objavljuje samo izgled – potvrde se tada
> NE spremaju (gost dobije poruku da potvrda nije spremljena, nikad lažno „poslano“).

Sve u Chrome pregledniku na tabletu, na **app.netlify.com**:

1. **Add new site → Import an existing project → GitHub** → odobrite pristup → izaberite repozitorij
   **`sejla-edvin-svadba`**. (Ovo pravi NOVU stranicu – postojeće stranice se ne diraju.)
2. **Branch to deploy:** `claude/zen-bell-nc113f`. Build command (`npm run build`) i Publish directory (`dist`)
   čitaju se sami iz `netlify.toml`. Kliknite **Deploy**.
3. **Site configuration → Environment variables → Add a variable**: Key `ADMIN_PASSWORD`, Value vaša šifra
   (12+ znakova) → **Create variable**.
4. **Deploys → Trigger deploy → Deploy site**, sačekajte **Published**.
5. **Site configuration → Change site name** → npr. `sejla-edvin-mladozenja` → link postaje
   `https://sejla-edvin-mladozenja.netlify.app`. Nakon promjene imena još jednom **Trigger deploy** (da slika za
   Viber/WhatsApp dobije novi puni link).
6. **Provjera:** otvorite link, pošaljite probnu potvrdu „Test Test“ → otvorite `…netlify.app/admin`, prijavite se,
   „Test Test“ mora biti na spisku s oznakom GOSTI KOD MLADOŽENJE → obrišite je.

### Samo izgled (bez potvrda) – ZIP
`isporuka/sejla-edvin-mladozenja.zip` sadrži gotov produkcijski build (`index.html` u korijenu).
Na tabletu: GitHub → repozitorij → folder `isporuka` → ZIP → **Download raw**; zatim na
**app.netlify.com/drop** izaberite ZIP. Koristite samo za brzi pregled izgleda.

## Lokalni rad

Node.js 22.12+.

```bash
npm install
npm run release        # build + provjera dist + ZIP u isporuka/
npm run test:api       # automatski test baze, grupe i admin zaštite
ADMIN_PASSWORD=probna-sifra node scripts/dev-api.mjs   # lokalni API (u drugom terminalu: npm run dev)
```
