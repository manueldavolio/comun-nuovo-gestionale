import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "admin@comunnuovo.it";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin Comun Nuovo";
const ADMIN_ROLE = "ADMIN" as const;
const ADMIN_PHONE = "3930000000";
const ADMIN_FIRST_NAME = "Admin";
const ADMIN_LAST_NAME = "Comun Nuovo";

export async function GET(request: Request) {
  const expectedSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
  const url = new URL(request.url);
  const providedSecret = url.searchParams.get("secret");

  if (!expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "BOOTSTRAP_ADMIN_SECRET non configurata.",
      },
      { status: 500 },
    );
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Secret non valido.",
      },
      { status: 401 },
    );
  }

  const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();
  const passwordHash = await hash(ADMIN_PASSWORD, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: normalizedEmail },
      update: {
        name: ADMIN_NAME,
        role: ADMIN_ROLE,
        passwordHash,
      },
      create: {
        email: normalizedEmail,
        name: ADMIN_NAME,
        role: ADMIN_ROLE,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    const existingAdminProfile = await tx.adminProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!existingAdminProfile) {
      await tx.adminProfile.create({
        data: {
          userId: user.id,
          firstName: ADMIN_FIRST_NAME,
          lastName: ADMIN_LAST_NAME,
          phone: ADMIN_PHONE,
        },
      });
    }

    return {
      email: user.email,
      role: user.role,
      adminProfileCreated: !existingAdminProfile,
    };
  });

  return NextResponse.json({
    ok: true,
    email: result.email,
    role: result.role,
    adminProfileCreated: result.adminProfileCreated,
  });
}
