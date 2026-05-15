import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../server/database/schema'
import dotenv from 'dotenv'

dotenv.config()

async function reset() {
  const postgresClient = postgres(process.env.DATABASE_URL!)

  const db = drizzle(postgresClient, {
    schema,
  })

  const tableSchema = db._.schema
  if (!tableSchema) {
    throw new Error('No table schema found')
  }

  console.log('🗑️ Emptying the entire database')

  // Disable foreign key constraints
  await db.execute(sql.raw('SET session_replication_role = replica;'))

  // Drop all PGMQ queues
  await db.execute(
    sql.raw(`
    DO $$
    DECLARE
      queue_name text;
    BEGIN
      FOR queue_name IN (
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'pgmq'
        AND table_name LIKE 'q_%'
      )
      LOOP
        EXECUTE format('SELECT pgmq.drop_queue(%L)', substring(queue_name from 3));
      END LOOP;
    END $$;
  `)
  )

  // Drop drizzle migrations
  await db.execute(sql.raw('DROP TABLE IF EXISTS "drizzle"."__drizzle_migrations" CASCADE;'))

  // Drop fetched_posts table (legacy table no longer in schema)
  await db.execute(sql.raw('DROP TABLE IF EXISTS "fetched_posts" CASCADE;'))

  // Drop all tables first
  const tableQueries = Object.values(tableSchema).map((table) => {
    console.log(`🧨 Preparing drop query for table: ${table.dbName}`)
    return sql.raw(`DROP TABLE IF EXISTS "${table.dbName}" CASCADE;`)
  })

  // Execute all table drop queries
  for (const query of tableQueries) {
    await db.execute(query)
  }

  // Drop all enum types with a more thorough query
  await db.execute(
    sql.raw(`
    DO $$
    DECLARE
      type_name text;
    BEGIN
      FOR type_name IN (
        SELECT t.typname
        FROM pg_type t
        INNER JOIN pg_namespace n ON (n.oid = t.typnamespace)
        WHERE t.typtype = 'e'
        AND n.nspname = 'public'
      )
      LOOP
        EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', type_name);
      END LOOP;
    END $$;
  `)
  )

  // Re-enable foreign key constraints
  await db.execute(sql.raw('SET session_replication_role = origin;'))

  console.log('✅ Database tables and enums dropped')

  process.exit(0)
}

reset().catch((e) => {
  console.error(e)
  process.exit(1)
})
