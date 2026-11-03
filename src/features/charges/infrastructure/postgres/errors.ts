const UNIQUE_VIOLATION = "23505";

/** True when Postgres refused a write over a unique constraint. Drivers wrap the error in causes. */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) {
      return true;
    }
  }
  return false;
}
