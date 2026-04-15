import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function upsertUser(params: {
  email: string;
  fullName: string;
  password: string;
  role: "ADMIN" | "COACH" | "PARENT";
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      fullName: params.fullName,
      role: params.role,
      isActive: true,
    },
    create: {
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      passwordHash: await hash(params.password, 12),
      isActive: true,
    },
  });
}

async function main() {
  await upsertUser({
    email: "admin@comunnuovocalcio.it",
    fullName: "Admin Comun Nuovo",
    password: "Admin123!",
    role: "ADMIN",
  });

  await upsertUser({
    email: "mister@comunnuovocalcio.it",
    fullName: "Mister Comun Nuovo",
    password: "Mister123!",
    role: "COACH",
  });

  await upsertUser({
    email: "genitore@comunnuovocalcio.it",
    fullName: "Genitore Comun Nuovo",
    password: "Genitore123!",
    role: "PARENT",
  });

  await prisma.category.upsert({
    where: { slug: "primi-calci" },
    update: { name: "Primi Calci", isActive: true },
    create: {
      name: "Primi Calci",
      slug: "primi-calci",
      description: "Attivita formativa per i piu piccoli.",
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: "pulcini" },
    update: { name: "Pulcini", isActive: true },
    create: {
      name: "Pulcini",
      slug: "pulcini",
      description: "Percorso tecnico e motorio categoria Pulcini.",
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: "esordienti" },
    update: { name: "Esordienti", isActive: true },
    create: {
      name: "Esordienti",
      slug: "esordienti",
      description: "Sviluppo tattico e atletico pre-agonistico.",
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
