import { NextResponse } from "next/server";
import { buildMarkPaidDisabledResponse } from "@/lib/payments/mark-paid-disabled";

export const runtime = "nodejs";

/**
 * DISABLED (S0 security): legacy manual mark-paid.
 * Previously allowed primary parents to set PAID, write accounting, generate PDFs under
 * public/receipts, and send email without Stripe. Do not re-enable without a dedicated
 * admin-designed flow. No payment lookup — response does not reveal payment data.
 */
export async function POST() {
  const disabled = buildMarkPaidDisabledResponse();
  return NextResponse.json(disabled.body, { status: disabled.status });
}

export async function GET() {
  const disabled = buildMarkPaidDisabledResponse();
  return NextResponse.json(disabled.body, { status: disabled.status });
}

export async function PUT() {
  const disabled = buildMarkPaidDisabledResponse();
  return NextResponse.json(disabled.body, { status: disabled.status });
}

export async function PATCH() {
  const disabled = buildMarkPaidDisabledResponse();
  return NextResponse.json(disabled.body, { status: disabled.status });
}

export async function DELETE() {
  const disabled = buildMarkPaidDisabledResponse();
  return NextResponse.json(disabled.body, { status: disabled.status });
}
