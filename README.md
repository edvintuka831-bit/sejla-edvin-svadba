# Šejla & Edvin – VERZIJA C · gosti kod mladoženje

Luksuzna 3D digitalna pozivnica za goste koji dolaze kod mladoženje Edvina, odakle svi zajedno idemo po mladu Šejlu.
Ovo je **zaseban projekat** (repozitorij `sejla-edvin-svadba`) i **zasebna Netlify stranica**.
Ranije pozivnice (repozitorij `Vjencanje-sejla-edvin`) nisu mijenjane i rade dalje na svojim adresama.

## Šta pozivnica sadrži

| Dio | Opis |
|---|---|
| Koverta | Bijela koverta sa zlatnim detaljima i voštanim pečatom, natpis *Šejla & Edvin · 23.01.2027.* i *Dodirnite da otvorite pozivnicu.* Dodir otvara preklop, izvlači pozivnicu i pokreće muziku. |
| 3D scena (Three.js / React Three Fiber) | Bijeli svadbeni automobil u stalnoj vožnji (okreću se točkovi, buket ruža i satenske trake), aleja s kamenim lukovima, cvjetnim vijencima, lampionima i čempresima, zlatno svjetlo zalaska sunca, refleksije na kamenoj aleji, prave sjene, padajuće latice i zlatne iskre. Kamera se filmski kreće kroz 7 kadrova dok gost skrola, a na kraju auto stiže do rotonde – kuće mlade. Sve je modelirano u kodu, bez vanjskih 3D fajlova. |
| Tekst | Kompletan tekst pozivnice za Verziju C. |
| Program | 11:00 okupljanje kod mladoženje (Slijevnice) → zajednički odlazak po mladu → 18:00 svadbeno slavlje (ADS Caffe & Restaurant). |
| Odbrojavanje | Do 23.01.2027. u 11:00 po vremenu BiH (Europe/Sarajevo) – dani, sati, minute, sekunde. Tačno bez obzira na vremensku zonu telefona. |
| Muzika | Zdravko Čolić – „Jedina“ (`public/audio/jedina.mp3`), kreće nakon dodira koverte; zlatno dugme dolje desno uključuje/isključuje. |
| Navigacija | Dugmad **LOKACIJA OKUPLJANJA** i **LOKACIJA RESTORANA** (Google Maps). |
| Potvrda dolaska | Ime i prezime, Dolazim / Ne mogu doći, broj osoba, napomena. Rok 02.01.2027. Svaki zapis dobija grupu **KOD MLADOŽENJE** (određuje je server). |
| Admin | `/admin` – prijava šifrom, statistika, pretraga, filter, izmjena, brisanje, Excel i CSV (s kolonom Grupa). |
| Dijeljenje | Naslov, opis i slika 1200×630 (`public/og-image.jpg`) za Viber, WhatsApp i Facebook. |

### Prilagođavanje uređajima
Automatski se bira kvalitet (telefon / tablet / računar): rezolucija, sjene, refleksije, broj latica.
Ako uređaj ne stiže, scena sama smanjuje kvalitet (animacija ostaje glatka). Bez WebGL-a prikazuje se
elegantna statična pozadina – pozivnica i forma rade normalno. Poštuje se „smanji pokrete“ u postavkama telefona.

## Potvrde dolaska – baza i sigurnost

| Dio | Tehnologija |
|---|---|
| Baza | **Netlify Blobs** (trajna pohrana ugrađena u Netlify, spremište `rsvp-mladozenja`) – nema vanjskog naloga ni ključeva u kodu |
| Server | Netlify Functions: `netlify/functions/rsvp.mjs` (`/api/rsvp`), `netlify/functions/admin.mjs` (`/api/admin/*`) |
| Potvrda upisa | Server upiše zapis, **ponovo ga pročita iz baze** i tek onda vrati uspjeh. Gost vidi „Hvala“ samo tada; u svakom drugom slučaju vidi „Potvrda NIJE spremljena“. |
| Admin šifra | Netlify varijabla **`ADMIN_PASSWORD`** (min. 8 znakova) – nikad u kodu stranice |
| Zaštita | HttpOnly kolačić 7 dana; 5 pogrešnih šifri → zaključavanje 15 min; ograničenje slanja; skriveno polje protiv botova; admin `noindex` |

## ⚠ Podaci koje još trebam od vas

Sve se mijenja u `src/config.js` (sekcija `LOCATIONS`):

1. **Tačan pin okupljanja u Slijevnicama** – trenutno dugme traži „Slijevnice, Kakanj“ (otvara mjesto, ne kuću).
   Pošaljite Google Maps link ili koordinate i upisuju se u `coords`, npr. `coords: '44.1234,18.1234'`.
2. **Restoran** – dugme traži „ADS Caffe & Restoran, Kakanj“ (objekat postoji pod tim nazivom na
   restoranskim imenicima). Otvorite dugme jednom na telefonu i potvrdite da Google Maps pokazuje pravi
   restoran; ako ne, pošaljite link ili koordinate.
3. **Muzika** – koristi se fajl `jedina.mp3` koji ste ranije dostavili za prethodnu pozivnicu. Pjesma nije mijenjana.
   Pravo javnog korištenja snimka je vaša odgovornost kao vlasnika pozivnice.
4. **3D model (opcionalno)** – automobil i arhitektura su proceduralno modelirani u kodu. Za još realističniji
   izgled konkretnog vozila potreban je licenciran `.glb` model (npr. bijeli Mercedes/Rolls-Royce sa Sketchfaba
   uz komercijalnu licencu, do ~5 MB); tada se ubacuje u `src/three/Car.jsx`.

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
   „Test Test“ mora biti na spisku s oznakom KOD MLADOŽENJE → obrišite je.

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
