# Audit Exporter V2 (Comun Nuovo → ClubVision)

## Scopo

Comando di **audit in sola lettura** che conta record, valida relazioni, classifica hash password e inventaria Storage (Supabase + fallback locali), producendo report locali preparatori alla migrazione.

**Questo non è l’export JSON definitivo** verso ClubVision.

## Natura read-only

Lo script:

- usa solo `count` / `findMany` / `aggregate` (Prisma);
- elenca oggetti Storage (`list`), senza upload/remove/move/copy;
- legge cartelle locali con `readdir` / `stat`;
- wrappa Prisma e Supabase Storage per **bloccare** operazioni di scrittura se richiamate per errore.

Non esegue:

- `prisma migrate` / `db push`;
- insert/update/delete;
- download di massa dei file;
- modifica di bucket o path.

## Prerequisiti env

Variabili necessarie (solo nomi; non committare valori):

- `DATABASE_URL` — obbligatoria per l’audit DB
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET` (default `enrollment-documents`)
- `SUPABASE_MEDICAL_VISITS_BUCKET` (default `medical-visit-certificates`)
- `SUPABASE_RECEIPTS_BUCKET` (opzionale; altrimenti fallback medical bucket)
- `SUPABASE_SITE_IMAGES_BUCKET` (opzionale; default `site-images`)

Se Storage non è configurato, l’inventario Supabase viene saltato e i check file si limitano ai fallback locali (con warning).

## Comando

```bash
npm run export:audit
```

Output custom:

```bash
npm run export:audit -- --out ./audit-output-custom
```

Flag utili (debug / CI senza rete):

```bash
npm run export:audit -- --skip-storage
npm run export:audit -- --skip-database --skip-storage --out ./audit-output-dry
```

(`--skip-database` senza Prisma produce verdetto `BLOCKED` / exit tecnico a seconda del flusso; usare solo per smoke locale.)

Test unitari (senza DB reale):

```bash
npm run test:export-audit
```

## File prodotti

Cartella default: `audit-output/` (gitignored)

| File | Contenuto |
|------|-----------|
| `audit-report.json` | Report strutturato completo |
| `audit-report.md` | Report leggibile |
| `database-counts.json` | Conteggi per modello |
| `storage-inventory.json` | Inventario oggetti Storage + locali |

## Verdetti

| Verdetto | Exit code | Significato |
|----------|-----------|-------------|
| `READY_FOR_EXPORT` | 0 | Nessun BLOCKING / warning rilevante |
| `READY_FOR_EXPORT_WITH_WARNINGS` | 0 | Procedibile con warning da rivedere |
| `BLOCKED` | 1 | Problemi che bloccano l’export futuro |
| errore tecnico inatteso | 2 | Crash / config mancante critica |

### BLOCKED (esempi)

- modelli fondamentali non leggibili (`User`, `Athlete`, `Enrollment`, `Payment`, `Receipt`)
- email duplicate case-insensitive
- taxCode atleta duplicati (normalizzati)
- receiptNumber duplicati
- FK orfane fondamentali / Payment senza Enrollment / Receipt senza Payment
- bcrypt malformato o algoritmo sconosciuto (scrypt/argon2/unknown)
- file obbligatori referenziati ma mancanti
- inventario Storage fallito in modo non recuperabile

### WARNING tipici

- oggetti Storage non referenziati
- fallback locali legacy presenti
- `passwordHash` vuoto (reset necessario; login app richiede hash)
- errori list Storage parziali
- CMS / campi opzionali

## Limiti

- Non valida il contenuto dei PDF (nessun download di massa).
- La list Storage dipende dalle API Supabase; cartelle molto profonde richiedono paginazione (implementata).
- Non prova le password; classifica solo il formato hash.
- Non genera ancora il pacchetto di migrazione ClubVision.
- I conteggi e l’inventario riflettono lo stato al momento dell’esecuzione.

## Cosa fare dopo

1. Eseguire l’audit su un ambiente concordato (staging o produzione in sola lettura).
2. Analizzare `audit-report.md`.
3. Risolvere i BLOCKING.
4. Solo dopo conferma, procedere alla fase di **export JSON definitivo** (non inclusa qui).

## Avvertenza

`npm run export:audit` prepara la migrazione ma **non** migra dati e **non** è l’export definitivo ClubVision.
