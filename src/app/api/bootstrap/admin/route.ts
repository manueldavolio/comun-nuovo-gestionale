import { timingSafeEqual } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "admin@comunnuovo.it";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin Comun Nuovo";
const ADMIN_PHONE = "3930000000";

const BASE_CATEGORIES = [
  {
    name: "Primi Calci",
    birthYearsLabel: "2018-2019",
    seasonLabel: "2026/2027",
    annualFee: "420.00",
    depositFee: "120.00",
    balanceFee: "300.00",
  },
  {
    name: "Pulcini",
    birthYearsLabel: "2016-2017",
    seasonLabel: "2026/2027",
    annualFee: "520.00",
    depositFee: "170.00",
    balanceFee: "350.00",
  },
  {
    name: "Esordienti",
    birthYearsLabel: "2014-2015",
    seasonLabel: "2026/2027",
    annualFee: "620.00",
    depositFee: "220.00",
    balanceFee: "400.00",
  },
] as const;

function parseAdminName(name: string) {
  const [firstName, ...lastNameParts] = name.trim().split(/\s+/);
  const lastName = lastNameParts.join(" ").trim() || "Admin";

  return {
    firstName: firstName ?? "Admin",
    lastName,
  };
}

function getBootstrapSecretFromRequest(request: Request) {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("token");
  const headerSecret = request.headers.get("x-bootstrap-secret");
  const authHeader = request.headers.get("authorization");

  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  return querySecret ?? headerSecret ?? bearerSecret;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isSecretValid(providedSecret: string, expectedSecret: string) {
  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

async function handleBootstrap(request: Request) {
  const expectedSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "BOOTSTRAP_ADMIN_SECRET non configurata.",
      },
      { status: 500 },
    );
  }

  const providedSecret = getBootstrapSecretFromRequest(request);
  if (!providedSecret || !isSecretValid(providedSecret, expectedSecret)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Token bootstrap non valido.",
      },
      { status: 401 },
    );
  }

  const { firstName, lastName } = parseAdminName(ADMIN_NAME);
  const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();
  const passwordHash = await hash(ADMIN_PASSWORD, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      const user = await tx.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: ADMIN_NAME,
          role: "ADMIN",
          passwordHash,
        },
        create: {
          email: normalizedEmail,
          name: ADMIN_NAME,
          role: "ADMIN",
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
        },
      });

      const existingAdminProfile = await tx.adminProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      const adminProfile = await tx.adminProfile.upsert({
        where: { userId: user.id },
        update: {
          firstName,
          lastName,
          phone: ADMIN_PHONE,
        },
        create: {
          userId: user.id,
          firstName,
          lastName,
          phone: ADMIN_PHONE,
        },
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      });

      const categories: Array<{
        id: string;
        name: string;
        seasonLabel: string;
        isActive: boolean;
        action: "created" | "updated";
      }> = [];

      for (const category of BASE_CATEGORIES) {
        const existingCategory = await tx.category.findUnique({
          where: {
            name_seasonLabel: {
              name: category.name,
              seasonLabel: category.seasonLabel,
            },
          },
          select: {
            id: true,
          },
        });

        const upsertedCategory = await tx.category.upsert({
          where: {
            name_seasonLabel: {
              name: category.name,
              seasonLabel: category.seasonLabel,
            },
          },
          update: {
            birthYearsLabel: category.birthYearsLabel,
            annualFee: category.annualFee,
            depositFee: category.depositFee,
            balanceFee: category.balanceFee,
            isActive: true,
          },
          create: {
            name: category.name,
            birthYearsLabel: category.birthYearsLabel,
            seasonLabel: category.seasonLabel,
            annualFee: category.annualFee,
            depositFee: category.depositFee,
            balanceFee: category.balanceFee,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            seasonLabel: true,
            isActive: true,
          },
        });

        categories.push({
          ...upsertedCategory,
          action: existingCategory ? "updated" : "created",
        });
      }

      return {
        admin: {
          userAction: existingUser ? "updated" : "created",
          profileAction: existingAdminProfile ? "updated" : "created",
          user,
          profile: adminProfile,
        },
        categories,
      };
    });

    const createdCategories = result.categories.filter(
      (category) => category.action === "created",
    );

    return NextResponse.json(
      {
        ok: true,
        admin: result.admin,
        categories: {
          totalProcessed: result.categories.length,
          createdCount: createdCategories.length,
          created: createdCategories.map((category) => ({
            id: category.id,
            name: category.name,
            seasonLabel: category.seasonLabel,
          })),
          all: result.categories,
        },
        errors: [],
      },
      { status: 200 },
    );
  } catch (error) {
    const prismaError =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? {
            code: error.code,
            meta: error.meta,
          }
        : null;

    console.error("[bootstrap-admin] Bootstrap failed", {
      message: getErrorMessage(error),
      prismaError,
    });

    return NextResponse.json(
      {
        ok: false,
        admin: null,
        categories: null,
        errors: [
          {
            message: getErrorMessage(error),
            prismaError,
          },
        ],
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleBootstrap(request);
}

export async function GET(request: Request) {
  return handleBootstrap(request);
}
