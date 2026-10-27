import { NextResponse } from "next/server";
import { buildBootstrapAdminDisabledResponse } from "@/lib/security/bootstrap-admin-disabled";

export const runtime = "nodejs";

/**
 * DISABLED (S1 security): legacy HTTP bootstrap admin.
 * Previously could upsert a fixed admin account with a hardcoded password when a
 * bootstrap env secret was set. Do not re-enable. Identical response for every caller:
 * no secret checks, no DB, no user data.
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
