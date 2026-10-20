# Piano migration — Disciplina / valutazioni Mister

**NON applicare in produzione senza autorizzazione esplicita.**

## Migration

- Cartella: `prisma/migrations/20261020120000_mister_discipline_ratings/`
- Operazioni: **additive** (nuovi enum/tabelle + colonne su `Event`). Nessuna `DROP`.
- Backfill: `LEAGUE_MATCH`→`LEAGUE`, `TOURNAMENT`→`TOURNAMENT`, `FRIENDLY`→`FRIENDLY` + `countsForDiscipline=false`; `seasonLabel` da categoria.

## 1. Backup (obbligatorio prima di produzione)

1. Snapshot Supabase / dump Postgres completo **prima** della migration.
2. Annotare:
   - commit applicativo da deployare insieme alla migration;
   - orario snapshot;
   - responsabile intervento.
3. Conservare lo snapshot fino a verifica post-go-live (almeno 7 giorni).

## 2. Test su staging (prima di produzione)

Su DB staging (clone o ambiente dedicato):

```bash
npx prisma migrate deploy
npm run test:discipline
npm run test:session-tools-privacy
npm run typecheck
npm run lint
npm run build
```

Smoke manuale staging:

1. Mister → Squadra: badge disponibilità + link disciplina.
2. Scheda atleta: situazione iniziale + cartellini + squalifica + conferma giornata.
3. Presenze gara: pannello cartellini/voti (voti opzionali).
4. Convocazioni: avviso non bloccante; **salvataggio / email / WhatsApp invariati**.
5. Creazione/modifica evento: campo Competizione su partite.
6. Riepilogo: tabella statistiche stagione.
7. Area Genitore: nessuna valutazione/disciplina esposta.

## 3. Applicazione produzione (solo dopo OK esplicito)

```bash
# solo dopo autorizzazione
npx prisma migrate deploy
```

Poi deploy applicativo del commit che include UI/API disciplina.

Ordine consigliato: **migration → deploy app** (l’app degrada se le tabelle mancano; non il contrario per le scritture disciplina).

## 4. Controlli post-migrazione

- Nessun errore 500 su `/mister`, `/mister/squadra`, `/mister/riepilogo`, convocazioni, presenze.
- Scrittura di un cartellino di prova e successivo void (audit presente).
- Situazione iniziale + gara post-riferimento: nessun doppio conteggio.
- Conferma giornata squalifica richiede azione esplicita.
- Genitore: payload senza chiavi valutazioni/disciplina (anti-leak).

## 5. Procedura di ripristino (rollback)

| Livello | Azione |
|--------|--------|
| App | Redeploy del commit precedente (UI/API smettono di scrivere disciplina). |
| DB | Restore snapshot pre-migration (tabelle disciplina + colonne `Event`). |
| Dati | Non è prevista down-migration automatica. |

Le colonne `Event.competitionKind` / `seasonLabel` / `countsForDiscipline` sono additive: il codice precedente le ignora.

Create/update evento hanno **fallback** se le colonne non esistono ancora (compatibilità pre-migration).

## 6. Cosa NON toccare durante l’intervento

- `scripts/export-v2/**`, `docs/COMUN_EXPORT_AUDIT.md`
- Pagamenti / Stripe / iscrizioni
- Logica salvataggio convocazioni, email, WhatsApp
