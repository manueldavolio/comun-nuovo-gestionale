import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  sendAdminNewUserNotification,
  sendRegistrationConfirmationEmail,
} from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/register";

type RegisterErrorCode =
  | "USER_CREATION_FAILED"
  | "PARENT_PROFILE_CREATION_FAILED";

class RegisterRouteError extends Error {
  code: RegisterErrorCode;
  cause?: unknown;

  constructor(code: RegisterErrorCode, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

function extractPrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      type: "PrismaClientKnownRequestError",
      code: error.code,
      clientVersion: error.clientVersion,
      meta: error.meta,
      message: error.message,
    };
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return {
      type: "PrismaClientUnknownRequestError",
      clientVersion: error.clientVersion,
      message: error.message,
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      type: "PrismaClientValidationError",
      clientVersion: error.clientVersion,
      message: error.message,
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      type: "PrismaClientInitializationError",
      errorCode: error.errorCode,
      clientVersion: error.clientVersion,
      message: error.message,
    };
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return {
      type: "PrismaClientRustPanicError",
      clientVersion: error.clientVersion,
      message: error.message,
    };
  }

  return null;
}

function buildPlaceholderTaxCode() {
  const token = randomUUID().replaceAll("-", "").toUpperCase().slice(0, 10);
  return `TMP${token}`;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("[register] Invalid JSON payload", {
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Richiesta non valida." },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("[register] Input validation failed", {
      issues: parsed.error.issues,
    });

    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName.trim();
  const email = parsed.data.email.toLowerCase().trim();
  const passwordHash = await hash(parsed.data.password, 12);
  const userRole = "PARENT";
  const fullName = `${firstName} ${lastName}`.trim();

  try {
    await prisma.$transaction(async (tx) => {
      let user: { id: string };

      try {
        user = await tx.user.create({
          data: {
            name: fullName,
            email,
            passwordHash,
            role: userRole,
          },
          select: {
            id: true,
          },
        });
      } catch (error) {
        console.error("[register] User creation failed", {
          email,
          prismaError: extractPrismaError(error),
          message: error instanceof Error ? error.message : String(error),
        });

        throw new RegisterRouteError(
          "USER_CREATION_FAILED",
          "Errore durante la creazione utente",
          error,
        );
      }

      try {
        await tx.parentProfile.create({
          data: {
            userId: user.id,
            firstName,
            lastName,
            taxCode: buildPlaceholderTaxCode(),
            phone: "",
            address: "",
            city: "",
            postalCode: "",
            province: "",
          },
        });
      } catch (error) {
        console.error("[register] ParentProfile creation failed", {
          email,
          userId: user.id,
          prismaError: extractPrismaError(error),
          message: error instanceof Error ? error.message : String(error),
        });

        throw new RegisterRouteError(
          "PARENT_PROFILE_CREATION_FAILED",
          "Errore durante la creazione profilo genitore",
          error,
        );
      }
    });
  } catch (error) {
    const rootError =
      error instanceof RegisterRouteError && error.cause !== undefined
        ? error.cause
        : error;
    const prismaError = extractPrismaError(rootError);

    console.error("[register] Registration failed", {
      message: rootError instanceof Error ? rootError.message : String(rootError),
      stack: rootError instanceof Error ? rootError.stack : undefined,
      prismaError,
    });

    if (
      rootError instanceof Prisma.PrismaClientKnownRequestError &&
      rootError.code === "P2002"
    ) {
      const target = Array.isArray(rootError.meta?.target)
        ? rootError.meta.target.join(",")
        : "";
      const isEmailConflict = target.includes("email");

      if (isEmailConflict) {
        return NextResponse.json({ error: "Email gia esistente." }, { status: 409 });
      }

      console.error("[register] Unique constraint conflict", { target });

      return NextResponse.json({ error: "Dati gia presenti." }, { status: 409 });
    }

    if (error instanceof RegisterRouteError && error.code === "USER_CREATION_FAILED") {
      return NextResponse.json(
        { error: "Errore durante la creazione utente." },
        { status: 500 },
      );
    }

    if (
      error instanceof RegisterRouteError &&
      error.code === "PARENT_PROFILE_CREATION_FAILED"
    ) {
      return NextResponse.json(
        { error: "Errore durante la creazione profilo genitore." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Errore durante la registrazione." },
      { status: 500 },
    );
  }

  const emailResults = await Promise.allSettled([
    sendRegistrationConfirmationEmail({
      to: email,
      name: fullName,
    }),
    sendAdminNewUserNotification({
      name: fullName,
      email,
      role: userRole,
      registeredAt: new Date(),
    }),
  ]);

  const registrationMailResult = emailResults[0];
  if (registrationMailResult.status === "rejected") {
    console.error("[register] Registration confirmation email rejected", {
      email,
      message:
        registrationMailResult.reason instanceof Error
          ? registrationMailResult.reason.message
          : String(registrationMailResult.reason),
    });
  } else if (!registrationMailResult.value.sent) {
    console.warn("[register] Registration confirmation email not sent", {
      email,
      skipped: registrationMailResult.value.skipped,
      reason: registrationMailResult.value.reason,
    });
  }

  const adminMailResult = emailResults[1];
  if (adminMailResult.status === "rejected") {
    console.error("[register] Admin notification email rejected", {
      email,
      message:
        adminMailResult.reason instanceof Error
          ? adminMailResult.reason.message
          : String(adminMailResult.reason),
    });
  } else if (!adminMailResult.value.sent) {
    console.warn("[register] Admin notification email not sent", {
      email,
      skipped: adminMailResult.value.skipped,
      reason: adminMailResult.value.reason,
    });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
