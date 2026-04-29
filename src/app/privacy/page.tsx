import Link from "next/link";

const privacyText = `INFORMATIVA PRIVACY PER ISCRIZIONE ATLETA MINORENNE
ASD Comun Nuovo Calcio

Ai sensi del Regolamento UE 2016/679 (“GDPR”), si informa che i dati personali forniti in fase di iscrizione saranno trattati da ASD Comun Nuovo Calcio per finalità connesse alla gestione dell’attività sportiva, associativa e amministrativa.

1. Titolare del trattamento
Il Titolare del trattamento è ASD Comun Nuovo Calcio, con sede presso il Centro Sportivo Comun Nuovo.
Per comunicazioni relative alla privacy è possibile contattare la società tramite i recapiti ufficiali indicati nel gestionale o sul sito della società.

2. Tipologia di dati trattati
Potranno essere trattati:
- dati anagrafici dell’atleta e dei genitori/tutori;
- dati di contatto;
- codice fiscale;
- dati relativi all’iscrizione sportiva;
- dati relativi a pagamenti e ricevute;
- dati relativi a certificazioni mediche e idoneità sportiva;
- immagini, fotografie e video, solo previo specifico consenso.

3. Finalità del trattamento
I dati saranno trattati per:
- gestione dell’iscrizione alla stagione sportiva;
- gestione amministrativa e contabile;
- emissione di ricevute e documenti;
- organizzazione di allenamenti, partite, convocazioni e comunicazioni;
- gestione delle visite mediche e delle scadenze sanitarie;
- adempimenti assicurativi, associativi e sportivi;
- eventuale pubblicazione di immagini e video per finalità istituzionali, informative e promozionali della società, solo se autorizzata.

4. Base giuridica
Il trattamento dei dati è necessario per l’esecuzione del rapporto associativo/sportivo, per adempiere a obblighi di legge e per la tutela dell’atleta.
Il trattamento di immagini e video avviene solo sulla base del consenso espresso del genitore/tutore.

5. Modalità del trattamento
I dati saranno trattati con strumenti cartacei, informatici e telematici, adottando misure adeguate di sicurezza per proteggerli da accessi non autorizzati, perdita, modifica o divulgazione.

6. Comunicazione dei dati
I dati potranno essere comunicati, nei limiti necessari, a:
- enti di promozione sportiva, federazioni o organismi sportivi;
- assicurazioni;
- consulenti amministrativi, fiscali o tecnici;
- fornitori di servizi informatici utilizzati dalla società;
- soggetti autorizzati dalla ASD per finalità organizzative e sportive.

I dati non saranno diffusi, salvo quanto previsto per immagini e video autorizzati.

7. Conservazione dei dati
I dati saranno conservati per il tempo necessario alla gestione del rapporto sportivo e agli obblighi amministrativi, fiscali, assicurativi e legali.
Le immagini e i video saranno utilizzati fino a eventuale revoca del consenso, salvo materiali già pubblicati o stampati per i quali la rimozione potrebbe non essere tecnicamente possibile.

8. Diritti dell’interessato
Il genitore/tutore può richiedere:
- accesso ai dati;
- rettifica;
- cancellazione, quando possibile;
- limitazione del trattamento;
- opposizione al trattamento;
- revoca del consenso per immagini e video.

La revoca del consenso non pregiudica la liceità del trattamento effettuato prima della revoca.

9. Dati sanitari
I certificati medici e le informazioni relative all’idoneità sportiva saranno trattati esclusivamente per verificare la possibilità dell’atleta di partecipare all’attività sportiva e per la gestione delle relative scadenze.

10. Consenso immagini e video
Con consenso separato, il genitore/tutore può autorizzare ASD Comun Nuovo Calcio a utilizzare immagini e video dell’atleta realizzati durante allenamenti, partite, eventi, manifestazioni sportive e attività societarie per finalità istituzionali, informative e promozionali, anche tramite sito web, social network, materiale cartaceo e canali ufficiali della società.

Il consenso è facoltativo e può essere revocato in qualsiasi momento.`;

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <section className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Informativa Privacy ASD Comun Nuovo</h1>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{privacyText}</div>

          <div className="mt-6">
            <Link
              href="/genitore/iscrizione/nuova"
              className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Torna al form
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

