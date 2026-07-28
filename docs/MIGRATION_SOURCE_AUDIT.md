# Audit sorgente migrazione → ClubVision

Documento generato in **sola lettura** dal repository `comun-nuovo-gestionale`.  
Nessuna interrogazione al database di produzione. Nessun valore di secret o variabile ambiente.  
Ogni conclusione è supportata da file citati. Dove il repository non fornisce evidenza, è indicato esplicitamente.

**Data audit:** 2026-07-28  
**Schema di riferimento:** `prisma/schema.prisma`  
**Script ClubVision nel repository:** **assenti** (ricerca `ClubVision` / `clubvision`: 0 match)

---

# 1. AUTENTICAZIONE

## Sistema utilizzato

| Domanda | Risposta | Evidenza |
|--------|----------|----------|
| Sistema | **NextAuth.js v4** (`next-auth`) | `package.json`, `src/lib/auth.ts` |
| Provider | Solo **Credentials** (email + password) | `src/lib/auth.ts` (`CredentialsProvider`) |
| Sessione | **JWT** (nessun adapter DB Session) | `src/lib/auth.ts` (`session.strategy: "jwt"`) |
| Supabase Auth | **Non usato** per login | Supabase client solo Storage (`persistSession: false`) in `src/lib/enrollment-documents.ts`, `src/lib/medical-visit-certificates.ts`, `src/lib/receipt-storage.ts`, `src/lib/site-storage.ts` |
| Auth.js v5 / Clerk / custom JWT stack | **Non presenti** come sistema login | — |

## File principali coinvolti nel login

| Ruolo | Percorso |
|-------|----------|
| Config NextAuth + `authorize` | `src/lib/auth.ts` |
| Route handler | `src/app/api/auth/[...nextauth]/route.ts` |
| Pagina login | `src/app/login/page.tsx` |
| Form login | `src/components/auth/login-form.tsx` |
| Registrazione | `src/app/register/page.tsx`, `src/components/auth/register-form.tsx`, `src/app/api/auth/register/route.ts` |
| Tipi sessione | `src/types/next-auth.d.ts` |
| Permessi / home per ruolo | `src/lib/permissions.ts` |
| Middleware (attualmente bypass) | `middleware.ts` |
| Creazione staff | `src/app/api/admin/staff/route.ts` |
| Bootstrap admin | `src/app/api/bootstrap/admin/route.ts`, `src/app/api/bootstrap-admin/route.ts` |
| Seed | `prisma/seed.ts` |

Nota: `middleware.ts` restituisce `NextResponse.next()` senza controllo sessione (commento “TEST TEMPORANEO”). L’autorizzazione è demandata alle pagine/API via `getAuthSession()`.

## Tabelle / modelli utenti

- **`User`** (`prisma/schema.prisma`): `id`, `name`, `email` (unique), `passwordHash`, `role`, `isActive`, timestamps.
- Profili 1:1 (FK `userId` → `User.id`, `onDelete: Cascade`):
  - **`ParentProfile`**
  - **`CoachProfile`**
  - **`AdminProfile`**
- **Nessun** modello NextAuth `Account` / `Session` / `VerificationToken`.
- **Nessuna** tabella `auth.users` (Supabase Auth) collegata all’applicazione.

## Relazione auth.users ↔ profili applicativi

**Non esiste.** L’identità vive interamente in `"User"` Prisma. I profili applicativi si agganciano a `User.id`. Il database può essere Postgres su Supabase (uso di `DATABASE_URL` + Storage), ma GoTrue/`auth.users` non è parte del flusso di autenticazione applicativo.

## Password: salvataggio e verifica

| Aspetto | Dettaglio | Evidenza |
|---------|-----------|----------|
| Libreria | `bcryptjs` | `src/lib/auth.ts`, `package.json` |
| Hash | `hash(plain, 12)` — cost factor **12** | `src/app/api/auth/register/route.ts`, bootstrap/staff |
| Verifica | `bcrypt.compare(plain, user.passwordHash)` | `src/lib/auth.ts` |
| Colonna | `User.passwordHash` (`TEXT NOT NULL`) | `prisma/schema.prisma`, migration full schema |
| Plaintext | Mai persistito | — |
| Formato atteso | Stringa bcrypt tipica `$2a$12$…` (60 caratteri) | Derivabile da `bcryptjs` cost 12 |
| Argon2 / scrypt / pbkdf2 | Non presenti nel codice app | — |

Controlli aggiuntivi al login: utente deve esistere, avere `passwordHash`, essere `isActive`.

**Staff:** in `src/app/api/admin/staff/route.ts` la password è `hash(randomUUID(), 12)` — password sconosciuta all’utente; in pratica richiede reset/invito.

**Reset password:** nessun flusso di change/reset password trovato sotto `src/`.

## Possibilità concreta di mantenere le stesse password in ClubVision

**Condizionatamente sì**, se ClubVision (o il suo IdP) accetta import di hash **bcrypt** con cost **12** (`$2a$` / `$2b$`).

| Scenario | Fattibilità |
|----------|-------------|
| Target con bcrypt compatibile | Copiare `email` + `passwordHash` |
| Target solo KDF proprietario senza import bcrypt | No silenzioso → reset forzato o verify-then-rehash al primo login |
| Utenti staff con hash di UUID casuale | Password non recuperabile → reset obbligatorio |
| Sessioni JWT NextAuth | Non migrabili; re-login richiesto |

**Non verificabile dal solo repository** se ClubVision supporta effettivamente l’import bcrypt: lo schema destinazione non è in questo repo.

## Ruoli disponibili

Enum `UserRole` in `prisma/schema.prisma`:

- `ADMIN`
- `PARENT`
- `COACH`
- `YOUTH_DIRECTOR`

Home tipiche (`src/lib/permissions.ts` / callback redirect in `src/lib/auth.ts`): Admin/Youth Director → area admin; Coach → `/mister`; Parent → `/genitore`.  
Registrazione pubblica: sempre `PARENT` (`src/app/api/auth/register/route.ts`).

## Utenti senza email o duplicati

- Schema: `email String @unique` + obbligatorio → **null email e duplicati bloccati a livello DB**.
- Register normalizza `toLowerCase().trim()`; conflitto → Prisma `P2002` / HTTP 409.
- Quantità di email vuote/anomale in produzione: **non ricavabile** senza query DB.

## Login Google / social / altri provider

**Assenti.** Solo `CredentialsProvider` in `src/lib/auth.ts`. Nessun `GoogleProvider`, OAuth, magic link o OTP.

---

# 2. DATABASE

## Tecnologia e ORM

| Voce | Valore | Evidenza |
|------|--------|----------|
| DB | **PostgreSQL** | `prisma/schema.prisma` (`provider = "postgresql"`), `prisma/migrations/migration_lock.toml` |
| Hosting tipico | Supabase Postgres + Storage (inferito da codice Storage/RLS CMS) | `src/lib/prisma.ts`, `supabase/site-cms-policies.sql` |
| ORM | **Prisma** | `prisma/schema.prisma`, `prisma.config.ts` |
| Schema | `prisma/schema.prisma` | — |
| Seed | `prisma/seed.ts` | — |

## Migration SQL Prisma (15)

Tutte sotto `prisma/migrations/`:

1. `20260416075204_full_schema/migration.sql`
2. `20260416081503_enrollment_module/migration.sql`
3. `20260416103000_enrollment_receipt_consents/migration.sql`
4. `20260416120000_coach_category_assignments/migration.sql`
5. `20260416123000_enrollment_drop_receipt_defaults/migration.sql`
6. `20260416143000_communications_media_module/migration.sql`
7. `20260416151939_finance_module/migration.sql`
8. `20260416170000_finance_module/migration.sql`
9. `20260421120000_user_active_status/migration.sql`
10. `20260423110000_convocations_module/migration.sql`
11. `20260429090000_stripe_enrollment_checkout/migration.sql`
12. `20260521120000_enrollment_documents/migration.sql`
13. `20260610120000_category_gioco_sport_and_scuola_calcio/migration.sql`
14. `20260610140000_under15_inactive_rename_esordienti/migration.sql`
15. `20260611150000_site_cms_module/migration.sql`

SQL extra (non storia Prisma migrate):

- `supabase/site-cms-schema.sql` — DDL CMS idempotente
- `supabase/site-cms-policies.sql` — RLS + bucket `site-images`

## Viste, funzioni, trigger

| Tipo | Esito nel repository |
|------|----------------------|
| Viste SQL | **Nessuna** nelle migration Prisma |
| Funzioni/procedure persistenti | **Nessuna** applicativa |
| Trigger | **Nessuno** |
| RLS | Sì, solo tabelle `Site*` + `storage.objects` per `site-images` (`supabase/site-cms-policies.sql`) |

## Note strutturali (società / stagione / squadra)

| Concetto ClubVision-like | Nel sorgente |
|--------------------------|--------------|
| Società / club | **Nessun modello**; club implicito single-tenant |
| Stagione | Campo stringa `seasonLabel` su `Category` e `Enrollment` |
| Squadra gestionale | Modello **`Category`** (categoria/stagione + quote) |
| Squadra sito pubblico | Enum `SiteTeam` su `SitePlayer` — **senza FK** ad `Athlete` |
| Giocatore | `Athlete` (gestionale) vs `SitePlayer` (CMS) |

## Inventario modelli (32)

### Auth e profili

#### `User`
- **Finalità:** account di accesso.
- **Colonne principali:** `name`, `email`, `passwordHash`, `role`, `isActive`.
- **PK:** `id` (cuid).
- **FK:** nessuna.
- **Relazioni:** profili; eventi/annunci/media/convocazioni/valutazioni/contabilità creati.
- **Sensibili:** email, hash password, nome.
- **Link:** radice utenti.

#### `ParentProfile`
- **Finalità:** anagrafica genitore/tutore.
- **Colonne:** `firstName`, `lastName`, `taxCode`, `phone`, `address`, `city`, `postalCode`, `province`.
- **PK:** `id`. **FK:** `userId` → `User`.
- **Sensibili:** CF, telefono, indirizzo.
- **Link:** User; genitori di `Athlete`.

#### `CoachProfile`
- **Finalità:** anagrafica allenatore.
- **Colonne:** `firstName`, `lastName`, `phone`, `notes?`.
- **PK:** `id`. **FK:** `userId` → `User`.
- **Link:** assegnazioni `CoachCategoryAssignment`; report mensili.

#### `AdminProfile`
- **Finalità:** anagrafica admin.
- **Colonne:** `firstName`, `lastName`, `phone`.
- **PK:** `id`. **FK:** `userId` → `User`.

### Categorie, atleti, iscrizioni, pagamenti

#### `Category`
- **Finalità:** categoria/squadra per stagione + quote.
- **Colonne:** `name`, `birthYearsLabel`, `seasonLabel`, `annualFee`, `depositFee`, `balanceFee`, `isActive`.
- **PK:** `id`. Unique `(name, seasonLabel)`.
- **Link:** stagione (`seasonLabel`), atleti, iscrizioni, eventi, ecc.

#### `Athlete`
- **Finalità:** giocatore gestionale.
- **Colonne:** anagrafica completa, `clothingSize?`, `medicalNotes?`, `parentId`, `categoryId`.
- **PK:** `id`. **FK:** `parentId` → `ParentProfile` (Restrict); `categoryId` → `Category` (Restrict).
- **Sensibili:** CF, nascita, indirizzo, note mediche.
- **Link:** giocatore ↔ genitore ↔ categoria/stagione.

#### `CoachCategoryAssignment`
- **Finalità:** M:N coach ↔ category.
- **PK:** `id`. Unique `(coachId, categoryId)`.
- **FK:** `coachId`, `categoryId`.

#### `Enrollment`
- **Finalità:** iscrizione stagione atleta-categoria.
- **Colonne:** `seasonLabel`, header ricevuta (`receipt*`), consensi booleani, `status`, `submittedAt`, `notes`.
- **PK:** `id`. Unique `(athleteId, categoryId, seasonLabel)`.
- **FK:** `athleteId`, `categoryId`.
- **Sensibili:** dati intestazione fiscale/contatto.

#### `EnrollmentDocument`
- **Finalità:** documenti ID/foto caricati in iscrizione.
- **Colonne:** `type`, `filePath`, `fileName`, `mimeType`, `size`.
- **PK:** `id`. Unique `(enrollmentId, type)`.
- **FK:** `enrollmentId` → `Enrollment`.

#### `Payment`
- **Finalità:** rate/quote legate all’iscrizione.
- **Colonne:** `type` (DEPOSIT/BALANCE/OTHER), `amount`, `dueDate`, `paidAt`, `status`, `paymentMethod`, Stripe IDs, `notes`.
- **PK:** `id`. **FK:** `enrollmentId`.
- **Sensibili:** importi, metodi, ID Stripe.

#### `Receipt`
- **Finalità:** ricevuta 1:1 su pagamento.
- **Colonne:** `receiptNumber`, `issueDate`, `amount`, `causal`, `paymentProvider`, `headerName`, `headerTaxCode`, `filePath`.
- **PK:** `id`. **FK:** `paymentId` (unique).

#### `ReceiptCounter`
- **Finalità:** contatore numerazione ricevute.
- **PK:** `id` (Int). Colonna: `lastValue`.

#### `StripeWebhookEvent`
- **Finalità:** idempotenza webhook Stripe.
- **Colonne:** `eventId`, `eventType`.

#### `AccountingEntry`
- **Finalità:** prime note entrate/uscite (opzionale link pagamento).
- **Colonne:** `type`, `category` (label), `description`, `amount`, `date` (`entryDate`), `paymentMethod`, `isForecast`, `notes`.
- **FK:** `createdById?` → `User`; `paymentId?` → `Payment`.

### Eventi, convocazioni, presenze

#### `Event`
- **Finalità:** allenamenti/partite/tornei.
- **Colonne:** `title`, `description`, `type`, `startAt`, `endAt`, `location`, `categoryId?`, `createdById`.
- **FK:** `categoryId` → `Category` (SetNull); `createdById` → `User`.

#### `Convocation` / `ConvocationAthlete`
- **Finalità:** lista convocati + risposta (PENDING/PRESENT/ABSENT).
- **FK:** event opzionale, category, createdBy; join athlete.

#### `Attendance`
- **Finalità:** presenza all’evento.
- **Colonne:** `status`, `notes`. Unique `(athleteId, eventId)`.

### Documenti e visite mediche

#### `MedicalVisit`
- **Finalità:** certificato medico / validità.
- **Colonne:** `visitDate`, `expiryDate`, `status`, `certificateFilePath`, `notes`.
- **FK:** `athleteId`.

#### `Document`
- **Finalità:** metadati documenti atleta (path spesso placeholder).
- **Colonne:** `type`, `title`, `filePath`, `expiryDate?`, `notes`.
- **FK:** `athleteId`.

### Comunicazioni, media, valutazioni

#### `Announcement`
- **Finalità:** comunicazioni interne per audience.
- **FK:** `categoryId?`, `createdById`.

#### `MediaItem`
- **Finalità:** foto/video di categoria.
- **Colonne:** `filePath?`, `mediaUrl?`, `mediaType`.

#### `MonthlyCoachReport`
- **Finalità:** report mensile allenatore (schema presente; UI/API prodotto non evidenziata sotto `src/app`).
- Unique `(coachId, categoryId, month, year)`.

#### `Evaluation`
- **Finalità:** valutazioni atleta per periodo (schema; UI/API prodotto non evidenziata sotto `src/app`).

### CMS sito pubblico (non collegato al gestionale atleti)

`SitePlayer`, `SiteStaffMember`, `SiteNews`, `SiteSponsor`, `SiteGalleryAlbum`, `SiteGalleryImage`, `SiteVideo`, `SiteSettings` — commento esplicito in `prisma/schema.prisma`: letti dal sito pubblico via Supabase anon key. Nessuna FK verso `Athlete`/`User`/`Category`.

---

# 3. ANAGRAFICHE

## Società

- **Nessuna tabella società.** Single-tenant implicito.
- Contenuti “Società” solo come stringa default su `SiteNews.category` e copy CMS (`SiteSettings`).

## Stagioni

- Non c’è modello `Season`.
- Stagione = `seasonLabel` (`String`) su `Category` e `Enrollment`.

## Squadre / categorie

- Gestionale: **`Category`** = unità operativa (nome, anni di nascita, stagione, quote, `isActive`).
- CMS: enum `SiteTeam` su `SitePlayer` (PRIMA_SQUADRA, FEMMINILE, UNDER_*, CALCIO_A_5_C2) — inventario marketing, non roster gestionale.

## Giocatori

Modello **`Athlete`** (`prisma/schema.prisma`):

- Anagrafica: `firstName`, `lastName`, `gender`, `birthDate`, `birthPlace`, `taxCode` (unique), `nationality`.
- Indirizzo: `address`, `city`, `postalCode`, `province`.
- Extra: `clothingSize?`, `medicalNotes?`.
- Collegamenti: `parentId` → `ParentProfile`; `categoryId` → `Category` (categoria “corrente”).

## Genitori e tutori

- **`ParentProfile`** + account `User` ruolo `PARENT`.
- Campi: CF, telefono, indirizzo completo.
- In registrazione, CF può essere placeholder `TMP…` (evidenza da audit register flow / uniqueness `taxCode`).

## Allenatori

- **`CoachProfile`** + `User` ruolo `COACH`.
- Assegnazione a categorie via **`CoachCategoryAssignment`**.

## Staff / dirigenti

- Staff applicativo = utenti `ADMIN` / `YOUTH_DIRECTOR` / `COACH` creati da admin (`src/app/api/admin/staff/route.ts`).
- Dirigenza pubblica sito = **`SiteStaffMember`** (nome, ruolo, category default `"Dirigenza"`, foto) — **senza** collegamento a `User`.

## Iscrizioni

- **`Enrollment`**: atleta + categoria + `seasonLabel`, stato `DRAFT|SUBMITTED|APPROVED|REJECTED`, consensi, intestazione ricevuta, documenti `EnrollmentDocument`, pagamenti.

## Collegamenti genitore-figlio

- Unico meccanismo: **`Athlete.parentId` → `ParentProfile.id`**.
- Non esiste tabella `family_links` multi-genitore / tutore secondario.
- Un atleta ha **un solo** genitore FK; un genitore può avere più atleti (`athletes[]`).

## Collegamenti account-atleta

- Gli atleti **non** hanno account `User`.
- Accesso dati atleta solo tramite account genitore (e staff).
- Non esiste `player_account_links`.

## Campi anagrafici rilevanti vs ClubVision tipico

| Campo | Dove nel sorgente | Note |
|-------|-------------------|------|
| Codice fiscale | `Athlete.taxCode`, `ParentProfile.taxCode`, `Enrollment.receiptTaxCode`, `Receipt.headerTaxCode` | Presente |
| Indirizzo | Atleta + genitore + receipt header enrollment | Presente |
| Telefono | `ParentProfile.phone`, `Enrollment.receiptPhone`, coach/admin phone | Presente su adulti; **non** su `Athlete` |
| Luogo di nascita | `Athlete.birthPlace` | Presente |
| Contatti di emergenza | — | **Non presenti** nello schema |
| Taglia abbigliamento | `Athlete.clothingSize` | Presente |
| Note mediche free-text | `Athlete.medicalNotes` | Presente (sensibile) |
| Nazionalità / genere | `Athlete.nationality`, `gender` | Presente |

---

# 4. PAGAMENTI E RICEVUTE

## Quote

- Su `Category`: `annualFee`, `depositFee`, `balanceFee`.
- **Alla creazione iscrizione**, gli importi pagamento **non** leggono le quote categoria: sono hardcoded in `src/app/api/genitore/enrollments/route.ts`:
  - DEPOSIT `50.00`, scadenza `2026-06-30`
  - BALANCE `200.00`, scadenza `2026-09-30`

## Rate / scadenze / tipi

- Tipi `PaymentType`: `DEPOSIT`, `BALANCE`, `OTHER`.
- Nessun modello di rateizzazione multipla oltre queste due rate tipiche.
- `dueDate` obbligatorio su `Payment`.

## Pagamenti / stato / metodo

| Voce | Dettaglio | Evidenza |
|------|-----------|----------|
| Stati | `PENDING`, `PAID`, `OVERDUE`, `CANCELLED` | `prisma/schema.prisma` |
| Stripe | Checkout session + webhook | `src/lib/stripe.ts`, `src/app/api/stripe/webhook/route.ts`, `src/lib/enrollment-payments.ts` |
| Metodo online | `"Online / Stripe"` | `enrollment-payments.ts` |
| Mark paid manuale | default `"Manuale dashboard (test)"` | `src/app/api/genitore/payments/[paymentId]/mark-paid/route.ts` |
| Rimborsi / sconti / acconti extra | **Nessuna** tabella o flusso dedicato | — |
| “Acconto/saldo” | Mappati a `DEPOSIT` / `BALANCE` | schema + enrollments route |

## Catena collegamenti

`Payment` → `Enrollment` → `Athlete` (+ `ParentProfile`) + `Category` + `seasonLabel`.

## Ricevute e numerazione

- Tabella `Receipt` 1:1 con `Payment`.
- Contatore `ReceiptCounter` per sequenza.
- **Due schemi di numerazione** nel codice:
  1. Path Stripe: prefisso tipo `CN-000001` via counter (`src/lib/enrollment-payments.ts`).
  2. Path mark-paid: prefisso annuale `CN-{year}-…` (`mark-paid/route.ts`).
- Campione locale in repo: `storage/receipts/RCV-2026-000001.pdf` (naming diverso dai prefissi `CN-`).

## PDF ricevute

| Aspetto | Dettaglio | File |
|---------|-----------|------|
| Generazione | `pdf-lib` | `src/lib/pdf.ts` |
| Upload Stripe path | Supabase Storage | `src/lib/receipt-storage.ts`, `enrollment-payments.ts` |
| Path tipico bucket | `receipts/{receiptNumber}.pdf` | `receipt-storage.ts` |
| Mark-paid | scrive anche sotto `public/receipts/` | `mark-paid/route.ts` |
| Rigenerazione admin | API dedicata | `src/app/api/admin/payments/[paymentId]/regenerate-receipt/route.ts` |
| Download genitore | | `src/app/api/genitore/receipts/[receiptId]/download/route.ts` |
| Firma | Testo stampato “Firma segreteria”, non firma digitale catturata | `pdf.ts` |

## Contabilità collegata

- `AccountingEntry` può riferire un `paymentId` (unique opzionale).
- UI finanze: `src/app/admin/finanze/page.tsx`, `src/lib/finance.ts`.

---

# 5. DOCUMENTI E CERTIFICATI

## Documenti caricati (upload reale)

### `EnrollmentDocument` + bucket `enrollment-documents`

| Tipo enum | Contenuto tipico |
|-----------|------------------|
| `PARENT_ID_FRONT` / `PARENT_ID_BACK` | Documento genitore |
| `ATHLETE_ID_FRONT` / `ATHLETE_ID_BACK` | Documento atleta |
| `ATHLETE_PORTRAIT` | Foto tessera |

Metadata DB: `filePath`, `fileName`, `mimeType`, `size`.  
API: `src/app/api/genitore/enrollment-documents/upload/route.ts`, download admin.  
Lib: `src/lib/enrollment-documents.ts`.  
Migration: `prisma/migrations/20260521120000_enrollment_documents/migration.sql`.

### Certificati medici

- Tabella **`MedicalVisit`**: date, `status` (`VALID|EXPIRING|EXPIRED`), `certificateFilePath`, note.
- Calcolo stato scadenza: `src/lib/expiry-status.ts` (&lt;0 scaduto; &lt;30 giorni in scadenza).
- Upload/download: API sotto `src/app/api/admin/medical-visits/` e `src/app/api/genitore/medical-visits/`.
- Storage: `src/lib/medical-visit-certificates.ts` (Supabase + legacy locale `storage/medical-visits`).

## Consensi privacy / regolamento / immagini

- **Boolean** su `Enrollment`: `privacyConsent`, `regulationConsent`, `imageConsent`.
- Pagine informative: `src/app/privacy/page.tsx`, `src/app/regolamento/page.tsx`.
- **Non** sono file firmati archiviati; sono flag al submit iscrizione.

## Documenti d’identità

- Via `EnrollmentDocument` (upload).
- Enum `DocumentType.ID_CARD` / `TAX_CODE` sul modello generico `Document` (metadati; upload cloud non equiparabile a enrollment docs).

## Firme

- Nessun modello di firma digitale / captazione firma.
- Su PDF ricevuta: solo label testuale.

## Moduli d’iscrizione

- Flusso UI genitore `src/app/genitore/iscrizione/…` + API enrollments.
- Persistenza: riga `Enrollment` + documenti + pagamenti.

## Foto

- Ritratto iscrizione (`ATHLETE_PORTRAIT`).
- CMS: `SitePlayer.photoUrl`, staff, gallery, news, sponsor (`site-images`).
- `MediaItem` PHOTO/VIDEO (upload cloud limitato secondo UI).

## Allegati generici `Document`

- Tipi: `ID_CARD`, `TAX_CODE`, `MEDICAL_CERTIFICATE`, `PRIVACY_FORM`, `IMAGE_CONSENT`, `OTHER`.
- Campi: `title`, `filePath`, `expiryDate?`, `notes`.
- **Nessuno stato di verifica/approvazione** sul documento.
- Form admin: path file come campo testuale (`src/components/documents/document-form.tsx`) — non pipeline Storage completa come enrollment/medical.

## Collegamento e scadenze

| Entità | Link | Scadenza / verifica |
|---------|------|---------------------|
| `EnrollmentDocument` | → Enrollment → Athlete | Nessuna expiry; vincolo unique per tipo |
| `MedicalVisit` | → Athlete | `expiryDate` + `status` |
| `Document` | → Athlete | `expiryDate` opzionale; no status verifica |
| Consensi | su Enrollment | Solo boolean submit |

---

# 6. STORAGE

## Bucket / archivi

| Nome | Pubblico/privato | Struttura path | Tipi | Campo DB | Policy / accesso |
|------|------------------|----------------|------|----------|------------------|
| `enrollment-documents` | Privato (service role) | `pending/{userId}/…` poi `enrollment-documents/{enrollmentId}/{type}-{ts}-{name}` | PDF/JPG/PNG ≤10MB | `EnrollmentDocument.filePath` | Download via app + service role; **no** `createSignedUrl` nel codice |
| `medical-visit-certificates` | Privato | `medical-visits/{ts}-{name}` (+ legacy FS) | PDF/JPG/PNG ≤10MB | `MedicalVisit.certificateFilePath` | Idem service role; fallback lettura `storage/medical-visits` |
| `receipts` (env `SUPABASE_RECEIPTS_BUCKET`; fallback possibile su bucket medical) | Privato | `receipts/{receiptNumber}.pdf` | PDF | `Receipt.filePath` | Service role upload/download |
| `site-images` | **Pubblico** | `{players\|staff\|news\|sponsors\|gallery}/{ts}-{name}` | JPG/PNG/WEBP/SVG ≤8MB | URL in campi Site* | RLS SELECT pubblica (`supabase/site-cms-policies.sql`); upload service role; `getPublicUrl` in `site-storage.ts` |

Costanti / env:

- `src/lib/enrollment-documents.ts` → `ENROLLMENT_DOCUMENTS_BUCKET_NAME = "enrollment-documents"`
- `src/lib/medical-visit-certificates.ts` → `"medical-visit-certificates"`
- `src/lib/receipt-storage.ts` → default `"receipts"`
- `src/lib/site-storage.ts` → `"site-images"`

## Archivi locali aggiuntivi

| Path | Uso |
|------|-----|
| `storage/medical-visits` | Legacy certificati |
| `public/receipts/` | Ricevute mark-paid |
| `storage/receipts/RCV-2026-000001.pdf` | Unico PDF campione nel repo |

## Signed URL

- **Nessun** uso di `createSignedUrl` trovato in `src/`.
- Accesso privati: download server-side con service role.
- Sito: solo URL pubblici.

## File orfani (rischio logico, non quantificato)

- Upload `pending/{userId}/…` se iscrizione non completata.
- Ricevute in doppio luogo (Supabase vs `public/receipts`).
- `Document.filePath` placeholder senza garanzia file esistente.
- Quantità produzione: **non ricavabile** dal repository (nessuno script inventario; 1 PDF sample locale).

---

# 7. DATI SPORTIVI

| Dominio | Presente? | Modello / note | Evidenza |
|---------|-----------|----------------|----------|
| Allenamenti | Sì | `Event` tipo `TRAINING`; bulk trainings API | `schema`, `src/app/api/admin/events/bulk-trainings/route.ts` |
| Presenze | Sì | `Attendance` | API `src/app/api/events/[eventId]/attendance/route.ts` |
| Partite | Sì | `Event` `LEAGUE_MATCH` / `FRIENDLY` / `TOURNAMENT` | schema |
| Convocazioni | Sì | `Convocation` | `src/app/api/convocations/…` |
| Risposte convocazioni | Sì | `ConvocationAthlete.responseStatus` | genitore/mister |
| Valutazioni | Schema sì / prodotto UI assente | `Evaluation` | solo schema |
| Note tecniche / report | Schema sì / UI assente | `MonthlyCoachReport` | schema + guard delete categorie |
| Ruoli / maglia | Solo CMS | `SitePlayer.role`, `shirtNumber` | **non** su `Athlete` |
| Eventi generici | Sì | `Event` | calendari admin/mister/genitore |
| Comunicazioni | Sì | `Announcement` | admin comunicazioni |
| Notifiche push | No | — | solo email Nodemailer |
| Storico stagioni | Parziale | `seasonLabel` su Category/Enrollment; atleta ha una `categoryId` corrente | schema |

---

# 8. AUTOMAZIONI E INTEGRAZIONI

| Tipo | Esito | Evidenza |
|------|-------|----------|
| Trigger SQL | Nessuno | migration Prisma |
| Funzioni DB app | Nessuna | — |
| Cron / Edge Functions | Nessuna in repo | no `vercel.json` cron, no `supabase/functions` |
| Webhook | Stripe | `src/app/api/stripe/webhook/route.ts` |
| Email | Nodemailer | `src/lib/mail.ts`, reminder medicali |
| Push | No | — |
| PDF | pdf-lib ricevute | `src/lib/pdf.ts` |
| Pagamenti | Stripe Checkout | `src/lib/stripe.ts` |
| Scadenze/rinnovi automatici | Solo calcolo status + reminder **manuali** admin | `src/lib/expiry-status.ts`, `src/app/api/admin/medical-visits/reminders/` |

---

# 9. VARIABILI AMBIENTE

Elenco **solo nomi** usati nel codice (nessun valore). Nessun `.env.example` committed trovato.

**Database / auth / bootstrap**

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `BOOTSTRAP_ADMIN_SECRET`
- `NODE_ENV`
- `VERCEL`

**Stripe**

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

**Supabase Storage**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_MEDICAL_VISITS_BUCKET`
- `SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET`
- `SUPABASE_RECEIPTS_BUCKET`
- `SUPABASE_SITE_IMAGES_BUCKET`

**Mail**

- `MAIL_HOST` / `SMTP_HOST`
- `MAIL_USER` / `SMTP_USER`
- `MAIL_PASS` / `SMTP_PASS`
- `MAIL_FROM` / `SMTP_FROM`
- `MAIL_PORT` / `SMTP_PORT`
- `MAIL_SECURE` / `SMTP_SECURE`
- `MAIL_CC`
- `SOCIETY_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL`
- `CLUB_RECEIPTS_EMAIL`

**Non trovate:** variabili `NEXT_PUBLIC_*`.

---

# 10. INVENTARIO MIGRAZIONE

Quantità: **non disponibili** (nessuna query produzione; seed non è inventario reale).  
Copertura script ClubVision: **nessuno script presente in questo repository** → colonna “copertura attuale” = **Nessuna**.

| Entità sorgente | Tabella/modello | Qty stimata | Destinazione probabile ClubVision | File Storage | Priorità | Rischio | Copertura script CV | Sviluppo aggiuntivo | Note |
|-----------------|-----------------|-------------|-----------------------------------|--------------|----------|---------|---------------------|---------------------|------|
| Utenti | `User` | n/d | `users` | — | P0 | Alto | Nessuna | Mapping ruoli; import bcrypt o reset | Auth NextAuth ≠ Supabase Auth |
| Profili genitore | `ParentProfile` | n/d | `users` + `memberships` / anagrafica | — | P0 | Medio | Nessuna | Campi CF/indirizzo | |
| Profili coach/admin | `CoachProfile`, `AdminProfile` | n/d | `memberships` / staff | — | P0 | Medio | Nessuna | Staff con password random | |
| Società | — | 0 | `clubs` | — | P0 | Basso | Nessuna | Creare club destinazione a mano | Single-tenant implicito |
| Stagioni | `seasonLabel` | n/d | stagione CV (se esiste) | — | P0 | Medio | Nessuna | Normalizzare label string | Non è tabella |
| Categorie/squadre | `Category` | n/d | `teams` | — | P0 | Medio | Nessuna | Quote categoria | |
| Atleti | `Athlete` | n/d | `players` | — | P0 | Alto | Nessuna | CF, nascita, medicalNotes | |
| Genitore-figlio | `Athlete.parentId` | n/d | `family_links` | — | P0 | Medio | Nessuna | Solo 1 genitore FK | |
| Account-atleta | — | 0 | `player_account_links` | — | P2 | Basso | Nessuna | Non esiste sorgente | |
| Iscrizioni | `Enrollment` | n/d | `enrollments` | — | P0 | Alto | Nessuna | Consensi boolean + header ricevuta | |
| Doc iscrizione | `EnrollmentDocument` | n/d | `documents` | `enrollment-documents` | P0 | Alto | Nessuna | Copia blob + remap path | |
| Pagamenti | `Payment` | n/d | `payments` | — | P0 | Alto | Nessuna | DEPOSIT/BALANCE; no refund | |
| Ricevute | `Receipt` | n/d | `payment_receipts` | `receipts` + locale | P0 | Alto | Nessuna | Dual numbering + dual storage | |
| Contatore ricevute | `ReceiptCounter` | 1 | operazionale CV | — | P1 | Medio | Nessuna | Continuare numerazione | |
| Stripe events | `StripeWebhookEvent` | n/d | — / log | — | P2 | Basso | Nessuna | Probabilmente non migrare | |
| Contabilità | `AccountingEntry` | n/d | ? (fuori lista CV data) | — | P1 | Medio | Nessuna | Gap destinazione | |
| Certificati medici | `MedicalVisit` | n/d | `medical_certificates` | `medical-visit-certificates` + legacy FS | P0 | Alto | Nessuna | Status + file | |
| Documenti generici | `Document` | n/d | `documents` | path incerto | P1 | Alto | Nessuna | Placeholder path | |
| Eventi/allenamenti | `Event` | n/d | `training_sessions` / `matches` / `society_events` | — | P1 | Medio | Nessuna | Discriminare per `EventType` | |
| Presenze | `Attendance` | n/d | `attendances` | — | P1 | Medio | Nessuna | | |
| Convocazioni | `Convocation`, `ConvocationAthlete` | n/d | `match_call_ups` | — | P1 | Medio | Nessuna | Risposte incluse | |
| Comunicazioni | `Announcement` | n/d | `communications` | — | P1 | Basso | Nessuna | Receipts comunicazioni: **assenti** sorgente | |
| Media categoria | `MediaItem` | n/d | ? | path/url | P2 | Medio | Nessuna | | |
| Valutazioni | `Evaluation` | n/d | ? | — | P2 | Basso | Nessuna | Schema senza UI | |
| Report coach | `MonthlyCoachReport` | n/d | ? | — | P2 | Basso | Nessuna | | |
| Assegnazioni coach | `CoachCategoryAssignment` | n/d | memberships/team staff | — | P1 | Basso | Nessuna | | |
| CMS sito | `Site*` (8 modelli) | n/d | fuori gestionale CV? | `site-images` | P2 | Medio | Nessuna | Prodotto sito separato | |

---

# 11. GAP RISPETTO A CLUBVISION

Destinazione di confronto (fornita):  
`users`, `memberships`, `clubs`, `teams`, `players`, `family_links`, `player_account_links`, `payments`, `payment_receipts`, `documents`, `medical_certificates`, `enrollments`, `training_sessions`, `attendances`, `matches`, `match_call_ups`, `communications`, `communication_receipts`, `society_events`.

## Dati sorgente senza destinazione chiara nella lista CV

- `AccountingEntry` (prima nota)
- `ReceiptCounter`, `StripeWebhookEvent`
- `MonthlyCoachReport`, `Evaluation`
- `MediaItem`
- Intero CMS `Site*` (+ bucket `site-images`)
- Quote su `Category` (`annualFee`/`depositFee`/`balanceFee`) se CV non ha fee template per team
- Header fiscali duplicati su `Enrollment` / `Receipt`
- `Athlete.clothingSize`, `Athlete.medicalNotes`
- Consensi come boolean (se CV richiede documenti firmati)
- Ruolo `YOUTH_DIRECTOR` (remap membership)

## Campi / modelli ClubVision “mancanti” lato sorgente (da creare o lasciare vuoti)

- `clubs` (società esplicita)
- `player_account_links` (nessun account atleta)
- `communication_receipts` (nessuna lettura/conferma comunicazione)
- Eventuale tabella stagioni dedicata (qui solo stringhe)
- Multi-genitore / tutori multipli (`family_links` ricchi)
- Contatti di emergenza

## Modelli ClubVision da estendere (probabile, per non perdere dati)

Per preservare il dominio attuale senza perdita, tipicamente servono estensioni o campi custom su:

- `players`: CF, luogo nascita, nazionalità, indirizzo, taglia, note mediche, genere
- `users` / memberships: CF e indirizzo genitore; telefono; ruolo youth director
- `payments`: tipi DEPOSIT/BALANCE/OTHER; Stripe IDs; dueDate/status enum locali
- `payment_receipts`: headerName/TaxCode; causal; paymentProvider; file path; numerazione custom
- `enrollments`: tre consensi boolean; header ricevuta; status DRAFT/SUBMITTED/…
- `documents`: tipi enrollment ID recto/verso + portrait; mime/size
- `medical_certificates`: status VALID/EXPIRING/EXPIRED; note
- Eventi: unificare `Event` polimorfico verso `training_sessions` / `matches` / `society_events`
- Contabilità / CMS: fuori scope lista CV → destinazione dedicata o esclusione consapevole

## Dati che potrebbero andare persi con un import “minimo” attuale

Poiché **non esiste script ClubVision in questo repo**, qualsiasi import esterno non documentato qui rischia di omettere:

1. Hash password / forzare reset
2. File Storage (enrollment, medical, receipts, legacy FS, `public/receipts`)
3. Ricevute con numerazione incoerente
4. Consensi solo-flag
5. Documenti generici con path placeholder
6. Contabilità, valutazioni, report coach, CMS sito
7. Storico stagioni se si migra solo `categoryId` corrente dell’atleta
8. Stripe metadata / webhook history

---

# 12. RISPOSTE FINALI ESPLICITE

### 1. Gli utenti possono mantenere la stessa email?
**Sì**, a livello sorgente: `User.email` è obbligatorio e unique (`prisma/schema.prisma`). La migrazione può ripubblicare le stesse email su ClubVision, salvo collisioni sul target (non verificabili qui).

### 2. Gli utenti possono mantenere la stessa password?
**Solo se ClubVision accetta hash bcrypt cost 12** copiati da `User.passwordHash`. Altrimenti no (reset). Gli account staff creati con `hash(randomUUID(), 12)` (`src/app/api/admin/staff/route.ts`) **non** hanno password nota → reset obbligatorio.

### 3. È possibile migrare tutti i documenti?
**Tecnicamente sì per `EnrollmentDocument`** (path + bucket `enrollment-documents`), **a condizione** di copiare i blob Supabase e rimappare i path.  
**Parziale/incerto per `Document`**: metadati sì, file spesso solo path testuale senza pipeline Storage garantita.  
**Orfani `pending/`** e file senza riga DB: rischio perdita/orfani. Quantità totale: n/d senza listing produzione.

### 4. È possibile migrare tutti i certificati medici?
**Sì in principio** da `MedicalVisit` + file in `medical-visit-certificates` e/o legacy `storage/medical-visits`, **se** tutti i `certificateFilePath` puntano a oggetti ancora esistenti. Verifica esistenza file: **non ricavabile dal solo repo**.

### 5. È possibile migrare tutte le ricevute e i relativi PDF?
**Metadati sì** (`Receipt`). **PDF: sì con cautela** — storage duale (Supabase `receipts`/fallback + `public/receipts/` + sample `storage/receipts/`), numerazione duale (`CN-…` vs `CN-{year}-…` vs sample `RCV-…`). Serve inventario file↔DB prima del cutover.

### 6. È possibile migrare quote, rate, acconti e saldi senza perdita?
**Rate DEPOSIT/BALANCE (e OTHER) + stati pagamento: sì** come righe `Payment`.  
**Quote teoriche di categoria** esistono ma **non** alimentano gli importi iscrizione (hardcoded 50/200) → rischio incoerenza “listino vs pagato”.  
**Rimborsi/sconti/acconti multipli oltre DEPOSIT:** non modellati → nulla da migrare, ma neanche da ricostruire.  
“Senza perdita” assoluta: **no** se si pretende allineamento listino categoria ↔ pagamenti storici.

### 7. Quali dati non sono oggi coperti dallo script ClubVision?
**Tutti.** In questo repository **non esiste** alcuno script/export/import ClubVision (0 match). Copertura = nessuna.

### 8. Quali dati richiedono una modifica allo schema ClubVision?
Al minimo, per non perdere il dominio gestionale attuale: campi anagrafici estesi su players/users; tipi pagamento/receipt header; consensi enrollment; tipi documento ID/portrait; status certificati; eventuale contabilità; discriminazione eventi; eventuale CMS se in scope. Vedi sezione 11.

### 9. Quali informazioni non sono ricavabili dal solo repository?
- Conteggio record produzione e volume Storage
- Esistenza reale di ogni file referenziato (orfani, pending, legacy)
- Valori env/secret e bucket effettivamente configurati in prod
- Se ClubVision supporta import bcrypt
- Contenuto reale dello “script ClubVision” (non presente qui)
- Email duplicate/anomale oltre i vincoli schema
- Quali ricevute sono solo locali vs solo Supabase in produzione
- Dati creati manualmente fuori app

### 10. Quali sono i cinque rischi maggiori del cutover?

1. **Auth mismatch:** NextAuth + bcrypt locale vs IdP ClubVision → lockout utenti se hash non importabili; staff già senza password nota.  
2. **Storage frammentato:** 4 bucket + FS legacy + `public/receipts` + pending orfani → PDF/documenti/certificati incompleti.  
3. **Pagamenti/ricevute inconsistenti:** importi hardcoded vs quote Category; doppia numerazione ricevute; Stripe IDs da rimappare o abbandonare.  
4. **Modello anagrafico più stretto della destinazione attesa:** un solo genitore FK; nessun account atleta; nessun club/stagione tabellare; CMS e contabilità fuori lista CV.  
5. **Assenza totale di tooling di migrazione nel repo:** ogni mapping/gap va costruito ex novo; alto rischio di perdita silenziosa (consensi, medicalNotes, storico stagioni, documenti placeholder).

---

## Riferimenti chiave (indice)

| Area | Percorsi |
|------|----------|
| Schema | `prisma/schema.prisma` |
| Migration | `prisma/migrations/**` |
| Auth | `src/lib/auth.ts`, `src/app/api/auth/**` |
| Pagamenti | `src/lib/enrollment-payments.ts`, `src/lib/stripe.ts`, `src/app/api/stripe/webhook/route.ts` |
| PDF | `src/lib/pdf.ts` |
| Storage | `src/lib/enrollment-documents.ts`, `src/lib/medical-visit-certificates.ts`, `src/lib/receipt-storage.ts`, `src/lib/site-storage.ts` |
| RLS CMS | `supabase/site-cms-policies.sql` |
| Iscrizione importi | `src/app/api/genitore/enrollments/route.ts` |

---

*Fine audit. Nessuna altra modifica al repository prevista da questo documento.*
