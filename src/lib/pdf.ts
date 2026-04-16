import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReceiptPdfData = {
  receiptNumber: string;
  issueDate: Date;
  companyName: string;
  companyAddress: string;
  companyCityPostalCode: string;
  companyVatOrTaxCode: string;
  athleteFullName: string;
  parentFullName: string;
  categoryName: string;
  seasonLabel: string;
  paymentType: "DEPOSIT" | "BALANCE";
  amount: string;
  paymentMethod?: string;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatEuro(amount: string): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(amount));
}

function getCausal(paymentType: "DEPOSIT" | "BALANCE"): string {
  if (paymentType === "DEPOSIT") {
    return "acconto";
  }
  return "saldo";
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  let cursorY = height - margin;

  page.drawRectangle({
    x: margin,
    y: cursorY - 54,
    width: width - margin * 2,
    height: 54,
    color: rgb(0.05, 0.21, 0.55),
  });

  page.drawText(data.companyName, {
    x: margin + 16,
    y: cursorY - 34,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
    maxWidth: width - margin * 2 - 180,
  });

  page.drawText("Ricevuta di pagamento", {
    x: width - margin - 130,
    y: cursorY - 34,
    size: 12,
    font: fontRegular,
    color: rgb(1, 1, 1),
  });

  cursorY -= 92;

  page.drawText(`Ricevuta n. ${data.receiptNumber}`, {
    x: margin,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Data emissione: ${formatDate(data.issueDate)}`, {
    x: width - margin - 170,
    y: cursorY,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  cursorY -= 36;
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    thickness: 1,
    color: rgb(0.82, 0.85, 0.9),
  });

  cursorY -= 28;
  const lineHeight = 20;
  const description = `iscrizione stagione ${data.seasonLabel} categoria ${data.categoryName}`;
  const details: Array<[string, string]> = [
    ["Societa", data.companyName],
    ["Indirizzo", data.companyAddress],
    ["CAP/Citta", data.companyCityPostalCode],
    ["P.I./C.F.", data.companyVatOrTaxCode],
    ["Atleta", data.athleteFullName],
    ["Intestatario/Genitore", data.parentFullName],
    ["Causale", getCausal(data.paymentType)],
    ["Categoria", data.categoryName],
    ["Stagione sportiva", data.seasonLabel],
    ["Descrizione", description],
    ["Importo", formatEuro(data.amount)],
    ["Metodo di pagamento", data.paymentMethod ?? "-"],
  ];

  for (const [label, value] of details) {
    page.drawText(`${label}:`, {
      x: margin,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: rgb(0.16, 0.16, 0.16),
    });

    page.drawText(value, {
      x: margin + 180,
      y: cursorY,
      size: 11,
      font: fontRegular,
      color: rgb(0.16, 0.16, 0.16),
      maxWidth: width - margin * 2 - 180,
    });

    cursorY -= lineHeight;
  }

  cursorY -= 20;
  page.drawRectangle({
    x: margin,
    y: cursorY - 96,
    width: width - margin * 2,
    height: 96,
    borderColor: rgb(0.86, 0.89, 0.94),
    borderWidth: 1,
  });

  page.drawText("Nota", {
    x: margin + 12,
    y: cursorY - 20,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText(
    "Ricevuta generata dal gestionale Comun Nuovo Calcio. Conservare questo documento per usi amministrativi e fiscali.",
    {
      x: margin + 12,
      y: cursorY - 44,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
      maxWidth: width - margin * 2 - 24,
      lineHeight: 14,
    },
  );

  page.drawText("Firma segreteria", {
    x: width - margin - 110,
    y: margin + 40,
    size: 10,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.35),
  });

  page.drawLine({
    start: { x: width - margin - 150, y: margin + 30 },
    end: { x: width - margin - 12, y: margin + 30 },
    thickness: 0.8,
    color: rgb(0.7, 0.7, 0.7),
  });

  return pdf.save();
}
