/**
 * Postgres error code for an error thrown by a query — resilient to drizzle
 * wrapping the driver error (the real code then lives on `.cause`). Use this
 * instead of reading `error.code` directly so unique-violation (23505) etc. are
 * detected whether or not drizzle wrapped the error.
 */
export function pgErrorCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } } | null
  return e?.code ?? e?.cause?.code
}
