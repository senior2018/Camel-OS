import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@@/server/database/schema'

export const postgresClient = postgres(
  useRuntimeConfig().databaseUrl || process.env.DATABASE_URL!,
  {
    prepare: false,
  }
)

export function useDrizzle() {
  return drizzle(postgresClient, { schema, logger: false })
}
