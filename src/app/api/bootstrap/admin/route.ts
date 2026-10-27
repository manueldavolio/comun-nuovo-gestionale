import { NextResponse } from "next/server";
import { buildBootstrapAdminDisabledResponse } from "@/lib/security/bootstrap-admin-disabled";

export const runtime = "nodejs";

/**
 * DISABLED (S1 security): legacy HTTP bootstrap admin (+ category seed).
 * Previously could upsert admin credentials and base categories when a bootstrap
 * env secret was set. Do not re-enable. No secret checks, no DB.
 */
async function disabled() {
  const response = buildBootstrapAdminDisabledResponse();
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}

export async function PUT() {
  return disabled();
}

export async function PATCH() {
  return disabled();
}

export async function DELETE() {
  return disabled();
}
