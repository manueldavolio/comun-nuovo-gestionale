import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function upsertUser(params: {
  email: string;
  name: string;
  password: string;
  role: "ADMIN" | "COACH" | "PARENT";
  legacyEmails?: string[];
}) {
  const passwordHash = await hash(params.password, 12);
  const legacyEmails = params.legacyEmails ?? [];

  for (const legacyEmail of legacyEmails) {
    const existingLegacyUser = await prisma.user.findUnique({
      where: { email: legacyEmail },
      select: { id: true },
    });

    if (existingLegacyUser) {
      const currentTargetUser = await prisma.user.findUnique({
        where: { email: params.email },
        select: { id: true },
      });

      if (!currentTargetUser) {
        await prisma.user.update({
          where: { id: existingLegacyUser.id },
          data: {
            email: params.email,
            name: params.name,
            role: params.role,
            passwordHash,
          },
        });
      }
    }
  }

  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      role: params.role,
      passwordHash,
    },
    create: {
      email: params.email,
      name: params.name,
      role: params.role,
      passwordHash,
    },
  });
}

async function upsertCategory(params: {
  name: string;
  birthYearsLabel: string;
  seasonLabel: string;
  annualFee: string;
  depositFee: string;
  balanceFee: string;
}) {
  return prisma.category.upsert({
    where: {
      name_seasonLabel: {
        name: params.name,
        seasonLabel: params.seasonLabel,
      },
    },
    update: {
      birthYearsLabel: params.birthYearsLabel,
      annualFee: new Prisma.Decimal(params.annualFee),
      depositFee: new Prisma.Decimal(params.depositFee),
      balanceFee: new Prisma.Decimal(params.balanceFee),
      isActive: true,
    },
    create: {
      name: params.name,
      birthYearsLabel: params.birthYearsLabel,
      seasonLabel: params.seasonLabel,
      annualFee: new Prisma.Decimal(params.annualFee),
      depositFee: new Prisma.Decimal(params.depositFee),
      balanceFee: new Prisma.Decimal(params.balanceFee),
      isActive: true,
    },
  });
}

async function ensureAnnouncement(params: {
  title: string;
  content: string;
  audience: "ALL" | "PARENTS" | "COACHES" | "CATEGORY_ONLY";
  createdById: string;
  categoryId?: string;
}) {
  const existing = await prisma.announcement.findFirst({
    where: {
      title: params.title,
      createdById: params.createdById,
      audience: params.audience,
      categoryId: params.categoryId ?? null,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.announcement.create({
    data: {
      title: params.title,
      content: params.content,
      audience: params.audience,
      categoryId: params.categoryId ?? null,
      createdById: params.createdById,
      publishedAt: new Date(),
    },
    select: { id: true },
  });
}

async function ensureMediaItem(params: {
  title: string;
  mediaType: "PHOTO" | "VIDEO";
  categoryId: string;
  createdById: string;
  mediaUrl: string;
  description?: string;
}) {
  const existing = await prisma.mediaItem.findFirst({
    where: {
      title: params.title,
      createdById: params.createdById,
      categoryId: params.categoryId,
      mediaType: params.mediaType,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.mediaItem.create({
    data: {
      title: params.title,
      description: params.description ?? null,
      mediaType: params.mediaType,
      categoryId: params.categoryId,
      createdById: params.createdById,
      mediaUrl: params.mediaUrl,
      filePath: null,
      publishedAt: new Date(),
    },
    select: { id: true },
  });
}

async function main() {
  const adminUser = await upsertUser({
    email: "admin@comunnuovo.it",
    name: "Admin Comun Nuovo",
    password: "admin123",
    role: "ADMIN",
  });

  const coachUser = await upsertUser({
    email: "mister@comunnuovo.it",
    name: "Mister Test",
    password: "mister123",
    role: "COACH",
    legacyEmails: ["mister@comunnuovocalcio.it"],
  });

  const parentUser = await upsertUser({
    email: "genitore@comunnuovo.it",
    name: "Genitore Test",
    password: "genitore123",
    role: "PARENT",
    legacyEmails: ["genitore@comunnuovocalcio.it"],
  });

  await prisma.adminProfile.upsert({
    where: { userId: adminUser.id },
    update: {
      firstName: "Admin",
      lastName: "Comun Nuovo",
      phone: "3490000001",
    },
    create: {
      userId: adminUser.id,
      firstName: "Admin",
      lastName: "Comun Nuovo",
      phone: "3490000001",
    },
  });

  const coachProfile = await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: {
      firstName: "Mister",
      lastName: "Test",
      phone: "3490000002",
      notes: "Allenatore categoria Pulcini",
    },
    create: {
      userId: coachUser.id,
      firstName: "Mister",
      lastName: "Test",
      phone: "3490000002",
      notes: "Allenatore categoria Pulcini",
    },
  });

  await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {
      firstName: "Genitore",
      lastName: "Test",
      taxCode: "GNTCMN80A01A794X",
      phone: "3490000003",
      address: "Via Roma 1",
      city: "Comun Nuovo",
      postalCode: "24040",
      province: "BG",
    },
    create: {
      userId: parentUser.id,
      firstName: "Genitore",
      lastName: "Test",
      taxCode: "GNTCMN80A01A794X",
      phone: "3490000003",
      address: "Via Roma 1",
      city: "Comun Nuovo",
      postalCode: "24040",
      province: "BG",
    },
  });

  await upsertCategory({
    name: "Primi Calci",
    birthYearsLabel: "2018-2019",
    seasonLabel: "2026/2027",
    annualFee: "420.00",
    depositFee: "120.00",
    balanceFee: "300.00",
  });

  const pulciniCategory = await upsertCategory({
    name: "Pulcini",
    birthYearsLabel: "2016-2017",
    seasonLabel: "2026/2027",
    annualFee: "520.00",
    depositFee: "170.00",
    balanceFee: "350.00",
  });

  await upsertCategory({
    name: "Esordienti",
    birthYearsLabel: "2014-2015",
    seasonLabel: "2026/2027",
    annualFee: "620.00",
    depositFee: "220.00",
    balanceFee: "400.00",
  });

  await prisma.coachCategoryAssignment.upsert({
    where: {
      coachId_categoryId: {
        coachId: coachProfile.id,
        categoryId: pulciniCategory.id,
      },
    },
    update: {},
    create: {
      coachId: coachProfile.id,
      categoryId: pulciniCategory.id,
    },
  });

  // Temporary safety net: keep all seeded categories open for parent enrollments.
  await prisma.category.updateMany({
    data: {
      isActive: true,
    },
  });

  const now = new Date();
  await prisma.monthlyCoachReport.upsert({
    where: {
      coachId_categoryId_month_year: {
        coachId: coachProfile.id,
        categoryId: pulciniCategory.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    },
    update: {
      notes: "Assegnazione categoria per calendario mister.",
    },
    create: {
      coachId: coachProfile.id,
      categoryId: pulciniCategory.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      notes: "Assegnazione categoria per calendario mister.",
    },
  });

  await ensureAnnouncement({
    title: "Riunione di inizio stagione",
    content: "Sabato alle 10:00 in sede. Presenza consigliata a tutte le famiglie.",
    audience: "ALL",
    createdById: adminUser.id,
  });

  await ensureAnnouncement({
    title: "Materiale allenamenti Pulcini",
    content: "Portare borraccia personale e k-way per i prossimi allenamenti.",
    audience: "CATEGORY_ONLY",
    categoryId: pulciniCategory.id,
    createdById: coachUser.id,
  });

  await ensureMediaItem({
    title: "Allenamento tecnico del martedi",
    mediaType: "PHOTO",
    categoryId: pulciniCategory.id,
    createdById: coachUser.id,
    mediaUrl: "https://example.com/media/pulcini-allenamento.jpg",
    description: "Sessione tecnica su controllo palla.",
  });

  await ensureMediaItem({
    title: "Highlights amichevole Pulcini",
    mediaType: "VIDEO",
    categoryId: pulciniCategory.id,
    createdById: adminUser.id,
    mediaUrl: "https://example.com/media/pulcini-amichevole.mp4",
    description: "Sintesi video dell'ultima amichevole.",
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
