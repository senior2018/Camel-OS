import postgres from 'postgres'
import dotenv from 'dotenv'

/**
 * One-shot backfill for the S5b lookup-values introduction. Inserts the
 * default opportunity sources + types for every existing organization. Safe
 * to re-run — ON CONFLICT DO NOTHING.
 */
dotenv.config()

const sql = postgres(process.env.DATABASE_URL!)

const orgs = await sql<Array<{ id: string }>>`SELECT id FROM organizations`

const sources: Array<[string, string, number]> = [
  ['tender', 'Tender', 0],
  ['grant', 'Grant', 1],
  ['partnership', 'Partnership', 2],
  ['referral', 'Referral', 3],
  ['inbound', 'Inbound', 4],
  ['other', 'Other', 5],
]
const types: Array<[string, string, number]> = [
  ['consulting', 'Consulting', 0],
  ['training', 'Training', 1],
  ['research', 'Research', 2],
  ['advisory', 'Advisory', 3],
  ['other', 'Other', 4],
]

for (const org of orgs) {
  for (const [key, label, sortOrder] of sources) {
    await sql`
      INSERT INTO crm_lookup_values (organization_id, kind, key, label, sort_order)
      VALUES (${org.id}, 'opportunity_source', ${key}, ${label}, ${sortOrder})
      ON CONFLICT (organization_id, kind, key) DO NOTHING
    `
  }
  for (const [key, label, sortOrder] of types) {
    await sql`
      INSERT INTO crm_lookup_values (organization_id, kind, key, label, sort_order)
      VALUES (${org.id}, 'opportunity_type', ${key}, ${label}, ${sortOrder})
      ON CONFLICT (organization_id, kind, key) DO NOTHING
    `
  }
}

console.log(`Backfilled ${orgs.length} organization(s).`)
await sql.end()
