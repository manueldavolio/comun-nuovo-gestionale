import { Prisma } from "@prisma/client";

const PRISMA_MISSING_RESOURCE_CODES = new Set(["P2021", "P2022"]);

function hasConvocationsHint(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }
  return /Convocation|ConvocationAthlete|ConvocationResponseStatus/i.test(value);
}

export function isMissingConvocationsSchemaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (!PRISMA_MISSING_RESOURCE_CODES.has(error.code)) {
      return false;
    }
    const target = (error.meta?.table as string | undefined) ?? (error.meta?.column as string | undefined) ?? "";
    return hasConvocationsHint(target) || hasConvocationsHint(error.message);
  }

  if (error instanceof Error) {
    return hasConvocationsHint(error.message) && /does not exist|non esiste|relation|table|column/i.test(error.message);
  }

  return false;
}

export const CONVOCATIONS_SCHEMA_MISSING_MESSAGE =
  "Modulo convocazioni non disponibile sul database. Applicare la migration 20260423110000_convocations_module.";
