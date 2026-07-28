import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";

const WRITE_METHOD_PATTERN =
  /^(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|executeRawUnsafe|\$executeRaw|\$executeRawUnsafe|runCommandRaw)$/;

const WRITE_DELEGATE_METHODS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

export class ReadOnlyViolationError extends Error {
  constructor(methodPath: string) {
    super(`Read-only audit Prisma client blocked write operation: ${methodPath}`);
    this.name = "ReadOnlyViolationError";
  }
}

function wrapDelegate(delegate: object, modelName: string): object {
  return new Proxy(delegate, {
    get(target, prop, receiver) {
      const key = String(prop);
      if (WRITE_DELEGATE_METHODS.has(key) || WRITE_METHOD_PATTERN.test(key)) {
        return () => {
          throw new ReadOnlyViolationError(`${modelName}.${key}`);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Creates a Prisma client that throws on write APIs.
 * Only findMany/findFirst/count/aggregate/groupBy/queryRaw are intended for audit use.
 */
export function createReadOnlyPrismaClient(connectionString: string): PrismaClient {
  const databaseUrl = new URL(connectionString);
  const poolConfig: PoolConfig = {
    host: databaseUrl.hostname,
    port: databaseUrl.port ? Number.parseInt(databaseUrl.port, 10) : 5432,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, "")),
    ssl: {
      rejectUnauthorized: false,
    },
    max: 3,
  };

  const adapter = new PrismaPg(new Pool(poolConfig));
  const client = new PrismaClient({
    adapter,
    log: ["error"],
  });

  return new Proxy(client, {
    get(target, prop, receiver) {
      const key = String(prop);

      if (key === "$executeRaw" || key === "$executeRawUnsafe" || key === "$runCommandRaw") {
        return () => {
          throw new ReadOnlyViolationError(key);
        };
      }

      if (key === "$transaction") {
        const original = Reflect.get(target, prop, receiver) as (...args: unknown[]) => unknown;
        return (...args: unknown[]) => {
          // Interactive transactions still use the same proxied client delegates.
          return original.apply(target, args);
        };
      }

      const value = Reflect.get(target, prop, receiver);
      if (
        value &&
        typeof value === "object" &&
        /^[a-z]/.test(key) &&
        !key.startsWith("$") &&
        key !== "constructor"
      ) {
        return wrapDelegate(value as object, key);
      }
      return value;
    },
  }) as PrismaClient;
}

export async function disconnectReadOnlyPrisma(client: PrismaClient | null): Promise<void> {
  if (!client) return;
  await client.$disconnect();
}
