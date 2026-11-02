import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const PDFDocument = require(path.join(process.env.TEMP, "pdf-write-tool", "node_modules", "pdfkit"));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Inline approved body (must stay aligned with src/lib/legal/document-bodies.ts SOCIETY_REGULATION_V1_BODY)
const body = `L’A.S.D. Comun Nuovo promuove il calcio come occasione di crescita sportiva, personale e sociale. Il presente regolamento definisce le regole di comportamento condivise da atleti, famiglie, allenatori, istruttori e dirigenti, nel rispetto delle persone, dei ruoli e delle disposizioni sportive applicabili.

1. Principi e obiettivi
• Insegnare il calcio nel rispetto delle regole, valorizzando la crescita tecnica ed educativa dei giovani atleti e il loro possibile percorso verso la prima squadra.
• Promuovere rispetto per compagni, allenatori, dirigenti, arbitri, avversari, strutture e materiali.
• Favorire un ambiente positivo, inclusivo e sereno, in cui sport, amicizia, impegno e collaborazione prevalgano sul risultato.

2. Allenatori, istruttori e dirigenti
• Attenersi alle direttive tecniche, organizzative ed educative della Società, mantenendo un comportamento esemplare.
• Vigilare sulla sicurezza durante allenamenti, partite e attività societarie e segnalare tempestivamente criticità o incidenti ai responsabili.
• Essere puntuali; utilizzare il materiale societario previsto per le partite e gli spazi di allenamento assegnati.
• Utilizzare un linguaggio adeguato all’età; evitare espressioni offensive o diseducative. Non fumare nelle aree tecniche e negli spazi in cui vige il divieto.
• Non utilizzare il cellulare durante allenamenti e partite, salvo necessità organizzative, di sicurezza o emergenze.
• Partecipare alle riunioni tecniche e organizzative convocate dalla Società e concordare preventivamente con la dirigenza iniziative che impegnino l’Associazione.
• Per le categorie agonistiche, comunicare di norma le convocazioni almeno due giorni prima, tramite i canali ufficiali, salvo variazioni o esigenze organizzative.
• Nelle convocazioni considerare presenza, comportamento, impegno e valutazione tecnica, nel rispetto del percorso formativo dell’atleta.

3. Atleti
• Rispettare persone, strutture, materiali, orari di allenamenti, convocazioni e partite.
• Utilizzare il kit e l’abbigliamento societario richiesti per allenamenti, gare, tornei e manifestazioni; eventuali necessità particolari vanno concordate con la Società.
• Per ragioni di sicurezza, non indossare durante l’attività sportiva oggetti potenzialmente pericolosi come orecchini, collane, anelli e orologi, secondo le regole applicabili.
• Curare l’igiene personale e il rispetto degli spogliatoi; la doccia dopo la partita è incoraggiata nel rispetto dell’età, della riservatezza e delle esigenze individuali.
• Comunicare tempestivamente assenze, impedimenti e situazioni rilevanti per la partecipazione in sicurezza, tramite i genitori quando necessario.

4. Famiglie e accompagnatori
• Sostenere i ragazzi con incoraggiamento e atteggiamento equilibrato, evitando pressioni eccessive, confronti, rimproveri dopo le gare e indicazioni dalla tribuna.
• Rispettare arbitri, avversari, allenatori, dirigenti, altri genitori e personale degli impianti; non sono ammessi comportamenti offensivi o intimidatori.
• Rispettare le scelte tecniche su ruolo, convocazioni, capitano e organizzazione dei gruppi; eventuali chiarimenti possono essere richiesti in modo rispettoso.
• Non accedere a spogliatoi, campo o altre aree riservate senza autorizzazione del personale responsabile.
• Per problemi ordinari rivolgersi all’allenatore o al responsabile di categoria; per questioni rilevanti al Presidente o a un suo delegato.

5. Essere Comun Nuovo: appartenenza e responsabilità
Indossare la maglia del Comun Nuovo significa condividere un percorso di crescita, rispetto, amicizia e orgoglio di rappresentare il proprio paese.
• La Società potrà proporre ai tesserati iniziative, eventi e attività di supporto educativo e sportivo, sempre adeguati all’età, volontari, supervisionati e nel rispetto delle norme di sicurezza e tutela dei minori.
• In presenza di condotte gravi, anche durante gare o allenamenti, la Società potrà adottare provvedimenti educativi e disciplinari proporzionati, previa valutazione dei fatti e ascolto degli interessati, nel rispetto delle norme applicabili.
• Eventuali attività riparative o di supporto potranno essere concordate con l’atleta e, se minorenne, con la famiglia, senza sostituire le sanzioni previste dagli organi sportivi competenti.

6. Quote di iscrizione
• Per partecipare all’attività è richiesto il pagamento della quota annuale nelle modalità e scadenze comunicate dalla Società per la stagione 2026/2027.
• In caso di mancato pagamento, la Società contatterà la famiglia per chiarire la situazione e concordare eventuali soluzioni; persistenti inadempimenti potranno comportare limitazioni alla partecipazione, nel rispetto degli impegni e delle norme applicabili.

7. Applicazione del regolamento
La Società promuove il rispetto del presente regolamento attraverso il dialogo e la collaborazione. Le eventuali violazioni saranno valutate in modo proporzionato, tenendo conto dell’età e delle circostanze. Restano ferme le disposizioni degli organismi sportivi e le norme vigenti.
Il presente regolamento disciplina i comportamenti sportivi e organizzativi; non sostituisce l’informativa sul trattamento dei dati personali né le eventuali autorizzazioni specifiche per l’utilizzo di immagini e video.`;

const out = path.join(root, "public", "docs", "Regolamento_ASD_Comun_Nuovo_2026-2027.pdf");
fs.mkdirSync(path.dirname(out), { recursive: true });

const doc = new PDFDocument({
  margin: 50,
  size: "A4",
  info: {
    Title: "Regolamento interno ASD Comun Nuovo 2026/2027 v1.0",
    Author: "ASD Comun Nuovo",
    Subject: "Regolamento approvato stagione 2026/2027 versione 1.0",
  },
});

const stream = fs.createWriteStream(out);
doc.pipe(stream);

doc.font("Helvetica-Bold").fontSize(14).text("A.S.D. COMUN NUOVO", { align: "center" });
doc.moveDown(0.3);
doc.fontSize(12).text("REGOLAMENTO INTERNO PER L'ATTIVITA' SPORTIVA", { align: "center" });
doc.moveDown(0.2);
doc.font("Helvetica").fontSize(10).text("STAGIONE 2026/2027 · Versione 1.0", { align: "center" });
doc.moveDown(0.2);
doc.fontSize(9).fillColor("#444444").text("Documento approvato", { align: "center" });
doc.fillColor("#000000");
doc.moveDown(1);

for (const block of body.split(/\n\n+/)) {
  const text = block.trim();
  if (!text) continue;
  if (/^\d+\.\s/.test(text) && !text.includes("•")) {
    doc.moveDown(0.35);
    doc.font("Helvetica-Bold").fontSize(11).text(text);
    doc.font("Helvetica").fontSize(10);
    continue;
  }
  if (text.includes("•")) {
    for (const line of text.split("\n")) {
      const item = line.replace(/^•\s*/, "").trim();
      if (!item) continue;
      if (line.trim().startsWith("•")) {
        doc.text(`• ${item}`, { paragraphGap: 2 });
      } else {
        doc.font("Helvetica").fontSize(10).text(item, { paragraphGap: 4 });
      }
    }
    doc.moveDown(0.25);
    continue;
  }
  doc.font("Helvetica").fontSize(10).text(text, { align: "justify", paragraphGap: 6 });
}

doc.moveDown(1);
doc.font("Helvetica-Oblique").fontSize(9).text("Versione 1.0 — Stagione 2026/2027 — Approvato");
doc.end();

await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});

const probe = await import("pdf-parse").catch(() => null);
if (!probe) {
  // optional verify via temp pdf-parse
}
console.log(JSON.stringify({ out, bytes: fs.statSync(out).size }));
