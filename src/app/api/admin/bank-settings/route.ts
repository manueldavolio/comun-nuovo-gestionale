import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  formatIbanForDisplay,
  getClubBankSettings,
  upsertClubBankSettings,
} from "@/lib/bank-transfer";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const settings = await getClubBankSettings();
  return NextResponse.json({
    settings: settings
      ? {
          beneficiary: settings.beneficiary,
          iban: settings.iban,
          ibanDisplay: formatIbanForDisplay(settings.iban),
          updatedAt: settings.updatedAt.toISOString(),
          configured: Boolean(settings.beneficiary.trim() && settings.iban.trim()),
        }
      : {
          beneficiary: "",
          iban: "",
          ibanDisplay: "",
          updatedAt: null,
          configured: false,
        },
  });
}

export async function PUT(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { beneficiary?: string; iban?: string }
    | null;

  const result = await upsertClubBankSettings({
    beneficiary: body?.beneficiary ?? "",
    iban: body?.iban ?? "",
    updatedById: session.user.id,
  });

  if ("error" in result) {
    if (result.error === "BENEFICIARY_REQUIRED") {
      return NextResponse.json({ error: "Beneficiario obbligatorio." }, { status: 400 });
    }
    if (result.error === "IBAN_INVALID") {
      return NextResponse.json({ error: "IBAN non valido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Salvataggio non riuscito." }, { status: 500 });
  }

  return NextResponse.json({
    settings: {
      beneficiary: result.settings.beneficiary,
      iban: result.settings.iban,
      ibanDisplay: formatIbanForDisplay(result.settings.iban),
      updatedAt: result.settings.updatedAt.toISOString(),
      configured: true,
    },
  });
}
