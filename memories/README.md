# Šejla & Edvin · Wedding Memories

Zajednička galerija svadbenih fotografija, videozapisa i čestitki za **23.01.2027.**, **ADS Caffe & Restaurant**.
Gosti skeniraju QR kod, šalju fotografije i videozapise bez registracije, a sadržaj se u galeriji
prikazuje **tek nakon što ga odobri jedan od dva administratora** (mladenci).

> Ovo je **zaseban projekat** u folderu `memories/` i **zasebna Netlify stranica**.
> Postojeća pozivnica u korijenu repozitorija se ne mijenja.

---

## 1. Šta aplikacija radi

### Gosti (`/`)
| Funkcija | Kako je riješeno |
|---|---|
| Otvaranje preko QR koda | QR vodi na javnu adresu stranice (generiše se u adminu ili `npm run qr`) |
| Više fotografija odjednom | Do 20 datoteka po slanju (veći izbor se sam dijeli u dijelove), 3 uploada paralelno |
| Videozapisi | MP4, MOV (iPhone), WEBM, 3GP, **do 50 MB** (granica Supabase Free plana; podesivo) |
| Bez registracije | Nema naloga; ime gosta je opcionalno |
| Samo odobreno | Galerija čita isključivo `status = approved` preko SQL funkcija |
| Čestitke | Ime + poruka do 1000 znakova, čekaju odobrenje |
| Status i greške | Po datoteci: priprema → šalje se X% → provjera → poslano / greška s razlogom, dugme „Pokušaj ponovo“ |
| Privatnost i saglasnost | Obavezan checkbox prije slanja + obavijest o privatnosti (dijalog) |

Dodatno: ekran ostaje upaljen tokom slanja, upozorenje pri zatvaranju stranice usred slanja,
iPhone fotografije (HEIC) i okretanje slike prema EXIF-u, galerija s karticama, beskonačnim pomjeranjem
i pregledom preko cijelog ekrana (listanje prstom).

### Administratori (`/admin`)
- prijava emailom i šifrom (Supabase Auth), **najviše dva računa** (zaključano u bazi)
- statistika: na čekanju, odobreno, odbijeno, ukupno poslano (broj i veličina), broj slanja, čestitke, zauzet prostor
- pregled na čekanju u punoj veličini, **odobri / odbij / obriši** pojedinačno ili grupno
- moderacija čestitki (objavi / odbij / obriši)
- preuzimanje **originala** pojedinačno i **kompletne ZIP arhive** (originali + čestitke CSV/TXT);
  na telefonu se velika arhiva dijeli na dijelove do 700 MB
- QR kod: kartica za štampu (PNG, 300 dpi A6), QR PNG 2000 px i SVG

## 2. Sigurnost

| Zahtjev | Rješenje |
|---|---|
| Bez admin ključeva u frontendu | U pregledniku je samo **publishable (anon)** ključ. **Secret** ključ postoji samo u Netlify Functions. |
| Privatni storage za neodobreno | Bucket `uploads` je **privatan**. Gosti nemaju nijednu storage politiku – upload ide samo preko **jednokratnih potpisanih linkova** koje izdaje server. |
| Odvojena javna dostupnost | Bucket `gallery` sadrži samo **kopije odobrenog** sadržaja (kopira ih server pri odobrenju, briše pri odbijanju/brisanju). Putanje su nasumični UUID-ovi, listanje nije dozvoljeno. |
| Bez skrivenih podataka u galeriji | Za galeriju se u pregledniku gosta prave nove JPEG kopije (2048 px i 640 px) **bez EXIF/GPS**. Originali ostaju privatni. |
| Row Level Security | Uključen na svim tabelama. Gosti (`anon`) nemaju nikakav pristup tabelama – samo `gallery_media`, `gallery_wishes`, `gallery_counts` (isključivo odobreno). Admin pristup preko `is_admin()`. |
| Sigurne serverske funkcije | `upload-init`, `upload-complete`, `wish`, `admin` (Netlify). Admin funkcija provjerava token kod Supabase Autha **i** članstvo u tabeli `admins`. |
| Masovno slanje | Ograničenja po uređaju/mreži (80/sat, 250/dan), globalno (4000/dan), 8 čestitki/sat, najviše 20 datoteka po slanju, ukupni limit prostora, skriveno polje protiv botova. IP se ne sprema – samo HMAC sažetak. |
| Nepoželjne datoteke | Dozvoljeni tipovi na 3 nivoa (preglednik, server, bucket). Nakon uploada server čita **stvarne prve bajtove** datoteke; ako to nije prava slika/video, datoteka se briše. Linkovi u čestitkama se odbijaju. |
| Ostalo | CSP i sigurnosna zaglavlja (`netlify.toml`), `/admin` je `noindex`, cijela stranica `robots: Disallow`, prijave ograničava Supabase Auth. |

## 3. Struktura

```
memories/
├── supabase/migrations/20261106000000_wedding_memories.sql   ← SVE za bazu, RLS i storage
├── supabase/config.toml        ← samo za lokalni razvoj (npx supabase start)
├── netlify/functions/          ← serverske funkcije (/api/...)
├── netlify/lib/core.mjs        ← zajednički kod, ograničenja, provjera sadržaja
├── src/guest/                  ← stranica za goste (slanje, čestitke, galerija, privatnost)
├── src/admin/                  ← administracija (moderacija, preuzimanje, QR)
├── src/lib/                    ← konfiguracija, Supabase klijent, obrada slika/videa
├── scripts/test-api.mjs        ← 21 automatski test API-ja, RLS-a i storagea
├── scripts/e2e-test.mjs        ← 18 koraka kroz preglednik u mobilnom prikazu
├── scripts/make-qr.mjs         ← QR iz komandne linije
├── netlify.toml                ← build, funkcije, preusmjeravanja, sigurnosna zaglavlja
└── .env.example                ← popis svih varijabli
```

---

## 4. Povezivanje sa Supabaseom (korak po korak)

Sve se radi u pregledniku na **supabase.com/dashboard**. Oznaka ⚠ znači da to morate uraditi ručno.

1. ⚠ **New project** → ime npr. `sejla-edvin-memories`, regija **Central EU (Frankfurt)**, jaka šifra baze (sačuvajte je).
   - **Plan:** Free plan ima **1 GB** ukupnog prostora i najviše 50 MB po datoteci – dovoljno za nekoliko stotina
     fotografija, ali **ne za mnogo videa**. Za svadbu preporučujemo **Pro plan** (100 GB) bar za januar–februar 2027.,
     pa `STORAGE_LIMIT_MB` na Netlifyju postavite npr. na `95000`. Free projekti se pauziraju nakon 7 dana bez
     aktivnosti – otvorite stranicu dan prije svadbe.
2. ⚠ **SQL Editor → New query** → zalijepite **cijeli** sadržaj datoteke
   `supabase/migrations/20261106000000_wedding_memories.sql` → **Run**. Mora pisati *Success*.
   Provjera: **Storage** mora prikazati bucket `uploads` (Private) i `gallery` (Public).
3. ⚠ **Authentication → Sign In / Providers**:
   - **Allow new users to sign up → ISKLJUČITI** (niko se ne može sam registrovati),
   - Email provider ostaje uključen; **Confirm email** može ostati uključeno (korisnike pravite ručno, potvrđeni su).
   - **Authentication → Policies (Password)**: minimalna dužina šifre 12 (preporučeno).
4. ⚠ **Authentication → Users → Add user → Create new user** – dva puta (za Šejlu i Edvina):
   email + jaka šifra (12+ znakova), označite **Auto Confirm User**.
5. ⚠ **SQL Editor** – upišite STVARNE emailove ta dva računa i pokrenite:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users
   where email in ('EMAIL_SEJLA@primjer.com', 'EMAIL_EDVIN@primjer.com');

   select * from public.admins;   -- moraju biti tačno 2 reda
   ```
   Treći administrator se ne može dodati (baza to odbija).
6. ⚠ **Project Settings → Data API**: kopirajte **Project URL**.
   **Project Settings → API Keys**: kopirajte **Publishable key** i **Secret key**
   (ako projekt prikazuje samo stare ključeve: `anon` = publishable, `service_role` = secret).
   **Secret key nikad ne stavljajte u kod, GitHub ili varijablu s prefiksom `VITE_`.**
7. ⚠ **Authentication → URL Configuration → Site URL**: upišite konačnu adresu stranice (nakon koraka 5. Netlify).

## 5. Objava na Netlifyju (korak po korak)

1. ⚠ **app.netlify.com → Add new site → Import an existing project → GitHub** → repozitorij **`sejla-edvin-svadba`**.
2. ⚠ Postavke builda:
   - **Branch to deploy:** grana s ovim kodom (trenutno `claude/zen-bell-nc113f`, ili `main` nakon spajanja)
   - **Base directory: `memories`** ← obavezno
   - Build command `npm run build` i Publish directory `dist` (Netlify ih čita iz `memories/netlify.toml`),
     Functions directory `netlify/functions`.
3. ⚠ **Site configuration → Environment variables** (sve iz `.env.example`):

   | Ključ | Vrijednost | Napomena |
   |---|---|---|
   | `VITE_SUPABASE_URL` | Project URL | javno |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key | javno |
   | `SUPABASE_SECRET_KEY` | Secret key | označite **Contains secret values**, scope *Functions* |
   | `RATE_LIMIT_SECRET` | dug nasumičan tekst (npr. 40 znakova) | tajno |
   | `VITE_PUBLIC_SITE_URL` | konačna adresa (korak 5) | za QR |
   | `STORAGE_LIMIT_MB` | `950` (Free) ili npr. `95000` (Pro) | opcionalno |

4. **Deploy** → sačekajte *Published*.
5. ⚠ **Site configuration → Change site name** → npr. `sejla-edvin-uspomene` → adresa
   `https://sejla-edvin-uspomene.netlify.app` (ili povežite vlastitu domenu). Upišite je u `VITE_PUBLIC_SITE_URL`
   i u Supabase *Site URL*, pa **Deploys → Trigger deploy**.
6. ⚠ **QR kod**: otvorite `…/admin` → prijava → **QR kod** → provjerite adresu → **Kartica za štampu (PNG)**.
   Ili lokalno: `npm run qr -- https://vasa-konacna-adresa`. QR štampajte **tek nakon** što je adresa konačna.

> Stranica mora biti objavljena **preko GitHub veze** – ručno prevlačenje ZIP-a (Netlify Drop) ne objavljuje
> serverske funkcije, pa slanje ne bi radilo (gost bi dobio jasnu poruku o grešci).

## 6. ⚠ Obavezna provjera na pravim telefonima (prije svadbe)

Automatski testovi su prošli (vidi 7.), ali **na pravom iPhoneu i Android telefonu, na objavljenoj adresi**
morate jednom proći ovaj spisak – to ne može zamijeniti nijedan test u radnom okruženju:

1. iPhone (Safari): skenirajte QR kamerom → stranica se otvara.
2. Pošaljite 3 fotografije iz galerije telefona + 1 kratak video (MOV) → sve pločice „Poslano“.
3. Android (Chrome): isto, uz jednu fotografiju direktno iz kamere.
4. Pošaljite čestitku.
5. Na jednom telefonu otvorite `/admin` → prijava → **Na čekanju** → otvorite pregled → **Odobri** sve → objavite čestitku.
6. Na drugom telefonu osvježite galeriju → vide se fotografije, video se reproducira, čestitka se vidi.
7. U adminu: **Original** na jednoj fotografiji (otvori se/snimi u puni kvalitet) i **Preuzimanje → Pripremi arhivu → Preuzmi** (ZIP se snimi u Preuzimanja/Files).
8. Obrišite probne stavke (**Obriši**).

## 7. Šta je testirano (u radnom okruženju)

Na **lokalnom Supabaseu** (isti Postgres/Auth/Storage kao produkcija, pokrenut `npx supabase start`) i sa istim
serverskim funkcijama:

- `npm run test:api` – **21/21**: dva admina (treći odbijen), saglasnost obavezna, nedozvoljen format / prevelik video /
  bot odbijeni, potpisani link jednokratan, tuđe slanje se ne može potvrditi, **lažna slika (nasumični bajtovi kao .jpg) odbačena i obrisana**,
  gost nema pristup tabelama, privatnim datotekama, uploadu mimo servera ni admin funkcijama, korisnik koji nije admin odbijen,
  original preuzet bajt-po-bajt identičan, odobravanje / odbijanje / brisanje u oba bucketa, čestitke, ograničenja slanja.
- `npm run test:e2e` – **18/18** kroz Chromium u **mobilnom prikazu iPhone 13 (gost) i Pixel 7 (admin)**, na razvojnom
  serveru i na **produkcijskom buildu**: izbor 6 datoteka odjednom, napredak i greške po datoteci, slanje → admin prijava →
  grupno odobravanje → galerija kod gosta → preuzimanje originala videa (identičan) → **ZIP arhiva** (3 fotografije + video
  identični originalima + čestitke) → QR kartica → uklanjanje/brisanje. Provjereno je i da javna kopija **nema EXIF/GPS**
  i da je pravilno okrenuta.
- Ručno: video od 41 MB uspješno poslan i provjeren.

**Nije testirano:** pravi iPhone/Android uređaji, Safari (WebKit) i stvarni Supabase/Netlify projekti – oni još ne postoje
(ključeve i adrese ne izmišljamo). Zato je korak 6 obavezan.

## 8. Lokalni razvoj

Node.js 22.12+, Docker.

```bash
cd memories
npm install
npx supabase start            # lokalni Supabase (Docker); ispisuje URL i ključeve
cp .env.example .env.local    # upišite lokalni URL, publishable i secret ključ
npm run dev:api               # terminal 1: serverske funkcije na :8788
npm run dev                   # terminal 2: stranica na :5173 (/api ide na :8788)
npm run test:api              # pravi i probne administratore admin1@test.local / admin2@test.local
npm run test:e2e
```

## 9. Poznata ograničenja i savjeti

- **Video do 50 MB** na Free planu ≈ 30–60 s videa s iPhonea u 1080p. Na Pro planu se globalna granica može podići
  u Supabase → Storage → Settings, pa `MAX_VIDEO_MB` i `file_size_limit` bucketa (SQL) uskladiti. Za duže snimke
  gosti mogu poslati originale mladencima drugim putem.
- **HEIC** fotografije: iPhone ih obično sam pretvori u JPEG pri slanju. Ako preglednik ne može napraviti pregled,
  original se ipak čuva i preuzima, ali takva fotografija se ne može objaviti u galeriji (admin dobije jasnu poruku).
- Galerija je dostupna svakome ko ima link (to je smisao QR koda), ali je pretraživači ne indeksiraju.
- Napušteni uploadi (gost zatvorio stranicu) brišu se automatski nakon 6 sati.
- Nakon svadbe: preuzmite kompletnu arhivu („Sve“) i po želji pauzirajte/obrišite Supabase projekt.
