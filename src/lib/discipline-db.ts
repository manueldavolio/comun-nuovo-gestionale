/**
 * Rilevamento schema disciplina non ancora migrato (P2021/P2022 / colonne mancanti).
 * Consente alle pagine esistenti di degradare senza crash prima della migration.
 */

const PRISMA_MISSING_RESOURCE_CODES = new Set(["P2021", "P2022"]);

const DISCIPLINE_HINT =
  /DisciplinaryIncident|DisciplinaryOpeningBalance|DisciplinarySuspension|DisciplinarySuspensionServing|DisciplinaryAuditLog|MatchPlayerRating|competitionKind|countsForDiscipline/i;

function readPrismaCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export function isMissingDisciplineSchemaError(error: unknown): boolean {
  const code = readPrismaCode(error);
  if (code && PRISMA_MISSING_RESOURCE_CODES.has(code)) {
    return true;
  }
  if (error instanceof Error) {
    return (
      DISCIPLINE_HINT.test(error.message) &&
      /does not exist|non esiste|relation|table|column|Unknown arg/i.test(error.message)
    );
  }
  return false;
}
