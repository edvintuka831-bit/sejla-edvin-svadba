# Šejla & Edvin · Wedding Memories (bez Supabasea)

Zajednička galerija fotografija, videozapisa i čestitki za **23.01.2027.**, **ADS Caffe & Restaurant**.
Gosti skeniraju QR kod svog stola i odmah šalju, bez registracije. Sve ide u **jednu zajedničku galeriju**,
a gosti vide **samo ono što odobre Šejla ili Edvin**.

> Ovo je folder `uspomene/` i zasebna Netlify stranica. **Digitalna pozivnica** (korijen repozitorija) i ranija
> Supabase verzija (`memories/`) se ne mijenjaju i ne koriste se ovdje.

## 1. Gdje se šta čuva

| Šta | Gdje | Zašto |
|---|---|---|
| Fotografije i videi (originali, pregledi) | **Cloudflare R2**: jedan **privatni** bucket | 10 GB besplatno, preuzimanja i pregledi se **ne naplaćuju**, nema gašenja stranice kad se pređe besplatni dio |
| Spisak datoteka, statusi, čestitke, stolovi | **Netlify Blobs** (ugrađeno u Netlify) | bez dodatnog servisa; isto kao potvrde dolaska u pozivnici |
| Stranica i serverske provjere | **Netlify** | fotografije i videi **ne prolaze kroz Netlify**, pa se ne troši njegov besplatni saobraćaj |

### Troškovi i ograničenja
- **Cloudflare R2:**
  - **10 GB** prostora besplatno svakog mjeseca. Iznad toga plaća se oko **0,015 $ po GB mjesečno** (npr. 40 GB ≈ 0,45 $).
  - Pregledi i preuzimanja su besplatni.
  - Aplikacija je zadano ograničena na **9 GB** (`STORAGE_LIMIT_GB=9`), pa je trošak **0 $**. Kada se 9 GB popuni, gosti dobiju poruku da je prostor pun. Granicu možete podići (vidi 7.).
  - Cloudflare pri uključivanju R2 može tražiti karticu ili PayPal, iako se do 10 GB ništa ne naplaćuje.
- **Netlify Free:**
  - 300 kredita mjesečno, **zajedničkih za cijeli račun** (i za pozivnicu).
  - Ova stranica troši malo: otprilike 8 kredita za 200 gostiju s po 3 posjete.
  - **Svaka nova objava troši oko 15 kredita**, pa pred svadbu ne objavljujte bez potrebe.
- **Koliko stane u 9 GB:** otprilike 1500 fotografija, ili 1000 fotografija i 20 do 30 videa od po 100 MB.
- **Ograničenja za goste** (sva se mogu promijeniti, vidi `.env.example`):
  - fotografija do 30 MB, **video do 200 MB**, 20 datoteka po slanju;
  - po uređaju: 80 datoteka na sat, 250 na dan i 3 GB na dan;
  - 8 čestitki na sat.

## 2. Funkcije

**Gosti (`/`, a sa stola `/?sto=7`):**
- Bez računa. Na naslovnoj stoji oznaka stola, npr. „Sto 7“.
- Više fotografija i videa odjednom, s napretkom u % za svaku datoteku.
- Greške se prikazuju po datoteci, uz dugme „Pokušaj ponovo“.
- Čestitke mladencima.
- Galerija s karticama Sve, Fotografije, Videozapisi i Čestitke; pregled preko cijelog ekrana s listanjem prstom.
- Obavezna saglasnost prije slanja i obavijest o privatnosti.

**Administracija (`/admin`), samo prijave „Šejla“ i „Edvin“:**
- **Statistika:** na čekanju, odobreno, odbijeno, poslano i zauzet prostor.
- **Moderacija:** pregled u punoj veličini, odobri / odbij / obriši (pojedinačno ili grupno), filter po stolu i vrsti.
- **Čestitke:** objavi / odbij / obriši.
- **Stolovi i QR:** dodavanje, preimenovanje i brisanje stolova, ili „napravi 1–N“, **bez mijenjanja aplikacije**. Kartice za štampu imaju oznaku stola: štampa 4 kartice A6 na A4 ili ZIP sa PNG karticama na 300 dpi.
- **Preuzimanje:** originali pojedinačno i **kompletna ZIP arhiva** (originali u punoj kvaliteti, s oznakom stola i imenom gosta, plus čestitke u CSV i TXT). Na telefonu se velika arhiva dijeli na dijelove do 700 MB.
- **Sistem:** provjera podešavanja, privatnosti pohrane, zauzeća i procjena mjesečnog troška.

## 3. Sigurnost
| Zahtjev | Rješenje |
|---|---|
| Neodobreno je privatno | R2 bucket je privatan, bez javnog pristupa. Ništa se ne može otvoriti bez potpisa. |
| Gosti vide samo odobreno | Server izdaje linkove za prikaz (važe najviše 7 h) **samo za odobrene** stavke. Gostima se nikad ne daje original fotografije, nego samo pregled napravljen u pregledniku, **bez EXIF/GPS podataka**. |
| Upload bez računa, ali kontrolisan | Server izdaje jednokratni link za upload koji važi 2 h i prihvata **samo tačnu najavljenu veličinu i tip**. Nakon uploada server čita **stvarne prve bajtove**; ako to nije prava slika ili video, datoteka se briše. |
| Samo Šejla i Edvin | Dvije odvojene šifre (najmanje 12 znakova) u Netlify varijablama. Prijava traje 7 dana u HttpOnly, SameSite=Strict kolačiću s potpisom. Promjena šifre odjavljuje sve uređaje. **5 pogrešnih pokušaja zaključava prijavu na 15 min.** Postoji i zaštita od lažnih zahtjeva s drugih stranica. |
| Masovno slanje | Ograničenja po uređaju i ukupno, granica prostora, skriveno polje protiv botova. Linkovi u čestitkama se odbijaju. IP adresa se ne sprema, samo HMAC sažetak. |
| Istovremeni rad | Svaka promjena je zaseban zapis (bez zajedničkih brojača), pa 10 istovremenih slanja ili Šejla i Edvin istovremeno ne gube podatke. |
| Ključevi | U pregledniku **nema nijednog ključa**. R2 ključevi i šifre postoje samo u serverskim funkcijama. |
| Zaglavlja | CSP, HSTS, X-Frame-Options, nosniff, `noindex` za `/admin`, a `robots.txt` zabranjuje indeksiranje. |

---

## 4. Cloudflare R2: podešavanje (⚠ ručno, jednom)

Na **dash.cloudflare.com** (radi i u pregledniku na tabletu). Nazivi u Cloudflareu mogu biti malo drugačiji.

1. ⚠ Napravite besplatan Cloudflare račun → u meniju **R2 Object Storage** → uključite R2 (može tražiti karticu ili PayPal).
2. ⚠ **Create bucket:**
   - ime: `sejla-edvin-uspomene`;
   - Location: po želji **Jurisdiction → European Union (EU)**. Tada na Netlifyju dodajte `R2_JURISDICTION=eu`;
   - Default storage class: **Standard** (besplatnih 10 GB važi samo za Standard).
3. ⚠ U bucketu → **Settings**:
   - **Public access / R2.dev subdomain: ostaviti ISKLJUČENO**, bez Custom Domain. Bucket mora ostati privatan.
   - **CORS Policy → Add/Edit** → zalijepite ovo (adresu zamijenite **vašom konačnom** Netlify adresom):
     ```json
     [
       {
         "AllowedOrigins": ["https://sejla-edvin-uspomene.netlify.app"],
         "AllowedMethods": ["GET", "PUT", "HEAD"],
         "AllowedHeaders": ["content-type", "range"],
         "ExposeHeaders": ["ETag", "Content-Length"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
4. ⚠ **R2 → Manage API tokens → Create API token**:
   - Permissions: **Object Read & Write**;
   - **Specify bucket**: samo `sejla-edvin-uspomene`;
   - TTL: bez isteka ili do npr. 31.03.2027.
   - Kopirajte **Access Key ID** i **Secret Access Key** (prikazuju se samo jednom) te **Account ID**.
     Account ID je i dio adrese `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
5. Preporučeno: **Billing → Notifications** → obavještenje o naplati, da Vas Cloudflare obavijesti ako se ikad pojavi trošak.

## 5. Netlify: objava (⚠ ručno)

1. ⚠ **app.netlify.com → Add new site → Import an existing project → GitHub** → repozitorij `sejla-edvin-svadba`.
   Ovo pravi **novu** stranicu, a pozivnica ostaje netaknuta.
2. ⚠ Postavke builda:
   - **Branch:** `claude/zen-bell-nc113f` (ili `main` nakon spajanja);
   - **Base directory: `uspomene`**;
   - Build `npm run build`, Publish `dist` i Functions `netlify/functions` čitaju se iz `uspomene/netlify.toml`.
3. ⚠ **Site configuration → Environment variables.** Sve osim zadnje stavke označite kao **Contains secret values**:

   | Ključ | Vrijednost |
   |---|---|
   | `R2_ACCOUNT_ID` | Account ID iz koraka 4.4 |
   | `R2_BUCKET` | `sejla-edvin-uspomene` |
   | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | iz koraka 4.4 |
   | `R2_JURISDICTION` | `eu` (samo ako je bucket EU) |
   | `ADMIN_SEJLA_PASSWORD` | Šejlina šifra, **najmanje 12 znakova** (postavljate privatno) |
   | `ADMIN_EDVIN_PASSWORD` | Edvinova šifra, **najmanje 12 znakova** |
   | `SESSION_SECRET` | nasumičan tekst od najmanje 32 znaka (npr. iz generatora šifri) |
   | `VITE_PUBLIC_SITE_URL` | konačna adresa (korak 5), npr. `https://sejla-edvin-uspomene.netlify.app` |

4. **Deploy** → sačekajte *Published*.
5. ⚠ **Site configuration → Change site name** → npr. `sejla-edvin-uspomene`. Ista adresa mora biti:
   - u `VITE_PUBLIC_SITE_URL`;
   - u R2 CORS pravilu (korak 4.3).
   Zatim jednom **Trigger deploy**.
6. ⚠ Otvorite `…/admin` → prijava kao Šejla → **Sistem**: sve stavke moraju biti zelene.
7. ⚠ **Stolovi i QR** → upišite broj stolova (ili nazive) → **Spremi stolove** → **Štampaj sve kartice**
   (ili ZIP s PNG karticama za štampariju). Štampajte **tek kada je adresa konačna.**
   Uvijek postoji i **opšti QR** (bez stola) za ulaz i bar.

## 6. ⚠ Provjera prije svadbe

1. Na računaru: `npm run check:prod -- https://vasa-adresa.netlify.app` (vidi 8.). Prvo odobrite jednu probnu fotografiju,
   da provjera testira i privatnost pohrane. Provjerava:
   - sigurnosna zaglavlja;
   - da administracija bez prijave odbija pristup;
   - da je bucket privatan i da je CORS ograničen na Vašu stranicu;
   - da izmijenjen link ne otvara tuđu datoteku;
   - ograničenja veličine.
2. **Pravi telefoni** (obavezno, na objavljenoj adresi):
   1. iPhone (Safari): kamerom skenirajte QR kartice „Sto 1“ → na stranici piše „Sto 1“.
   2. Pošaljite 3 fotografije i **jedan duži video (100–200 MB)** → pratite procenat → sve „Poslano“.
   3. Android (Chrome): skenirajte drugi sto, pošaljite fotografiju direktno iz kamere i čestitku.
   4. U `/admin` na telefonu (Šejla): **Na čekanju** → pregled → **Odobri sve** → objavite čestitku.
   5. Drugi telefon (Edvin): prijava → provjerite da vidi isto.
   6. Gost: osvježite galeriju → fotografije s oba stola, video se reproducira, čestitka se vidi.
   7. **Original** jedne fotografije i **Preuzimanje → Pripremi arhivu → Preuzmi** na telefonu.
   8. Isprobajte slanje i na **Wi-Fi mreži sale** (brzina slanja videa zavisi od nje).
   9. Obrišite probne stavke. Pogledajte **Sistem → procjena troška**.

## 7. Promjena ograničenja
U Netlify varijablama (pa **Trigger deploy**):
- `STORAGE_LIMIT_GB`: npr. `40`. Prostor iznad 10 GB se plaća oko 0,015 $ po GB mjesečno.
- `MAX_VIDEO_MB`: najviše 200 je testirano; R2 tehnički prima do 5 GB po datoteci, ali na telefonu i mobilnoj mreži to nije praktično.

**Nakon svadbe:** u adminu **Preuzimanje → Sve** → snimite arhivu (na računaru u Chrome/Edge se snima kao jedna velika datoteka).
Zatim u Cloudflareu obrišite bucket (trošak 0 $), a Netlify stranicu po želji ugasite.

## 8. Testirano u radnom okruženju

Lokalno, s istim serverskim kodom: Netlify Blobs lokalni server, a umjesto Cloudflare R2 **S3-kompatibilni server (RustFS)**
s istim potpisanim linkovima i CORS pravilima.

- `npm run test:api`: **24/24**. Pokriva:
  - prijave Šejla/Edvin, pogrešna i tuđa šifra, zaključavanje nakon 5 pokušaja, lažni kolačić, zaštita od lažnih zahtjeva;
  - stolovi iz administracije;
  - saglasnost, format, video > 200 MB i bot odbijeni;
  - link za upload odbija drugu veličinu ili tip;
  - privatnost bucketa; lažna slika odbačena i obrisana;
  - prazna galerija prije odobrenja;
  - oznaka stola, filteri, original identičan;
  - galerija daje pregled, a ne original;
  - video se strimuje (Range);
  - odbijanje i brisanje;
  - čestitke, izvoz, provjera sistema;
  - **10 istovremenih slanja i istovremeno odobravanje oba administratora bez gubitka**;
  - ograničenja slanja, odjava.
- `npm run test:e2e`: **15/15** kroz Chromium u mobilnom prikazu (gost iPhone 13, admin Pixel 7), više uzastopnih prolaza:
  - stolovi napravljeni u adminu, 5 QR kartica u ZIP-u i priprema za štampu;
  - gost sa „Sto 2“ šalje 5 datoteka uključujući **video od 58 MB uz napredak u %**, a lažna slika je odbijena;
  - gost s „Mladenačkog stola“ šalje u istu galeriju;
  - Šejla filtrira po stolu i grupno odobrava;
  - gost vidi sve, a video se reproducira;
  - pregledi su bez EXIF/GPS;
  - original videa i **ZIP arhiva** su identični poslanim;
  - Edvin uklanja i briše;
  - provjera sistema pokazuje 0,00 $.
- Ručno:
  - video od **199 MB** poslan i provjeren;
  - svih 5 QR kartica dekodirano u tačne linkove stolova.

**Nije testirano:**
- pravi iPhone i Android uređaji, Safari (WebKit);
- pravi Cloudflare R2 i Netlify, jer računi još ne postoje i ključeve ne izmišljamo;
- ponašanje Netlify Blobs na produkciji pod velikim opterećenjem.

Zato su koraci iz poglavlja 6 obavezni prije svadbe.

## 9. Lokalni razvoj
Node.js 22.12+ i Docker.
```bash
cd uspomene && npm install
docker run -d --name r2local -p 9000:9000 -e RUSTFS_ACCESS_KEY=localkey -e RUSTFS_SECRET_KEY=localsecret123 rustfs/rustfs
cp .env.example .env.local   # lokalne vrijednosti: R2_ENDPOINT=http://127.0.0.1:9000, R2_REGION=us-east-1, R2_BUCKET=uspomene,
                             # R2_ACCESS_KEY_ID=localkey, R2_SECRET_ACCESS_KEY=localsecret123, probne šifre i SESSION_SECRET
node scripts/local-r2.mjs    # pravi lokalni bucket i CORS
npm run test:api             # pokreće vlastiti API s praznom bazom
npm run test:e2e             # pokreće API i stranicu sam (port 8788 i 5173 moraju biti slobodni)
npm run dev:api & npm run dev   # ručni rad: http://localhost:5173 i /admin
```
