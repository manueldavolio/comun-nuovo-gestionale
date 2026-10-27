import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BOOTSTRAP_ADMIN_DISABLED_BODY,
  BOOTSTRAP_ADMIN_DISABLED_STATUS,
  buildBootstrapAdminDisabledResponse,
} from "./bootstrap-admin-disabled";

const ROUTE_PATHS = [
  "src/app/api/bootstrap-admin/route.ts",
  "src/app/api/bootstrap/admin/route.ts",
] as const;

const ROUTE_MODULES = [
  "@/app/api/bootstrap-admin/route",
  "@/app/api/bootstrap/admin/route",
] as const;

describe("bootstrap admin disabled policy (S1)", () => {
  it("returns a generic 410 without secrets or credentials", () => {
    const disabled = buildBootstrapAdminDisabledResponse();
    assert.equal(disabled.status, BOOTSTRAP_ADMIN_DISABLED_STATUS);
    assert.equal(disabled.status, 410);
    assert.deepEqual(disabled.body, BOOTSTRAP_ADMIN_DISABLED_BODY);
    const serialized = JSON.stringify(disabled.body);
    assert.equal(serialized.includes("admin123"), false);
    assert.equal(serialized.includes("BOOTSTRAP"), false);
    assert.equal(serialized.includes("secret"), false);
    assert.equal(serialized.includes("password"), false);
    assert.equal(serialized.includes("comunnuovo"), false);
  });

  it("disables every HTTP method on both bootstrap routes without side effects", async () => {
    const previousSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
    process.env.BOOTSTRAP_ADMIN_SECRET = "synthetic-secret-must-not-unlock";

    try {
      for (const moduleId of ROUTE_MODULES) {
        const route = await import(moduleId);
        const methods = [route.GET, route.POST, route.PUT, route.PATCH, route.DELETE] as const;
        for (const handler of methods) {
          const response = await handler();
          assert.equal(response.status, 410);
          const body = (await response.json()) as { error?: string };
          assert.equal(body.error, "Operazione non disponibile.");
        }
      }
    } finally {
      if (previousSecret === undefined) {
        delete process.env.BOOTSTRAP_ADMIN_SECRET;
      } else {
        process.env.BOOTSTRAP_ADMIN_SECRET = previousSecret;
      }
    }

    for (const relativePath of ROUTE_PATHS) {
      const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
      assert.equal(source.includes("admin123"), false);
      assert.equal(source.includes("@/lib/prisma"), false);
      assert.equal(source.includes("from \"bcryptjs\""), false);
      assert.equal(source.includes("passwordHash"), false);
      assert.equal(source.includes("user.upsert"), false);
      assert.equal(source.includes("category.upsert"), false);
      assert.equal(source.includes("timingSafeEqual"), false);
      assert.equal(source.includes("getBootstrapSecretFromRequest"), false);
      assert.equal(source.includes("BOOTSTRAP_ADMIN_SECRET"), false);
      assert.equal(source.includes("path.join(process.cwd()"), false);
    }
  });

  it("keeps legitimate admin reset-password behind ADMIN session (unchanged)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/users/[userId]/reset-password/route.ts"),
      "utf8",
    );
    assert.match(source, /getAuthSession/);
    assert.match(source, /session\.user\.role !== "ADMIN"/);
    assert.match(source, /generateTemporaryPassword/);
    assert.equal(source.includes("admin123"), false);
    assert.equal(source.includes("BOOTSTRAP_ADMIN_SECRET"), false);
  });

  it("does not wire prisma seed into HTTP bootstrap routes or package deploy scripts", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string>; prisma?: { seed?: string } };

    assert.equal(typeof pkg.prisma?.seed, "string");
    assert.match(pkg.prisma?.seed ?? "", /prisma\/seed/);

    for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
      if (name === "prisma:seed") {
        continue;
      }
      assert.equal(
        command.includes("prisma db seed") || command.includes("prisma/seed"),
        false,
        `script ${name} must not auto-run seed on deploy`,
      );
    }

    assert.equal(
      (pkg.scripts?.build ?? "").includes("seed"),
      false,
      "build must not run seed",
    );
    assert.equal(
      (pkg.scripts?.postinstall ?? "").includes("seed"),
      false,
      "postinstall must not run seed",
    );

    const seed = readFileSync(path.join(process.cwd(), "prisma/seed.ts"), "utf8");
    assert.match(seed, /admin@comunnuovo\.it/);
    // Seed remains CLI-only; HTTP routes must not import it.
    for (const relativePath of ROUTE_PATHS) {
      const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
      assert.equal(source.includes("prisma/seed"), false);
      assert.equal(source.includes("seed.ts"), false);
    }
  });
});
