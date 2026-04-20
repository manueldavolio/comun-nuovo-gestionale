import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const databaseUrl = new URL(connectionString);

const poolConfig: PoolConfig = {
  host: databaseUrl.hostname,
  port: databaseUrl.port ? Number.parseInt(databaseUrl.port, 10) : 5432,
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, "")),
  // Required for TLS compatibility between Supabase Postgres and Vercel runtime.
  ssl: {
    rejectUnauthorized: false,
  },
};

const adapter = new PrismaPg(new Pool(poolConfig));

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}