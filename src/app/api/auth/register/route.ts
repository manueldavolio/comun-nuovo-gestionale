import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/register";

function buildPlaceholderTaxCode() {
  const token = randomUUID().replaceAll("-", "").toUpperCase().slice(0, 10);
  return `TMP${token}`;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Richiesta non valida." },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName.trim();
  const email = parsed.data.email.toLowerCase().trim();
  const passwordHash = await hash(parsed.data.password, 12);

  try {
    await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`.trim(),
        email,
        passwordHash,
        role: "PARENT",
        parentProfile: {
          create: {
            firstName,
            lastName,
            taxCode: buildPlaceholderTaxCode(),
            phone: "",
            address: "",
            city: "",
            postalCode: "",
            province: "",
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : "";
      const isEmailConflict = target.includes("email");

      return NextResponse.json(
        {
          error: isEmailConflict
            ? "Email gia registrata. Accedi oppure usa un'altra email."
            : "Dati gia presenti. Verifica le informazioni inserite.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Errore durante la registrazione. Riprova." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
