/**
 * One-shot: promote `admin@camel-os.com` to super admin if no super admin exists
 * yet for that org. Safe to re-run — does nothing if a super admin already
 * exists in the same organization.
 *
 * Run: `pnpm tsx scripts/promote-super-admin.ts`
 */
import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const sql = postgres(process.env.DATABASE_URL!)

const SEED_EMAIL = 'admin@camel-os.com'

const [target] = await sql<Array<{ id: string; organization_id: string; email: string }>>`
  SELECT id, organization_id, email FROM users WHERE email = ${SEED_EMAIL} LIMIT 1
`

if (!target) {
  console.log(`User ${SEED_EMAIL} not found — nothing to do.`)
  await sql.end()
  process.exit(0)
}

const [existing] = await sql<Array<{ id: string; email: string }>>`
  SELECT id, email FROM users
  WHERE organization_id = ${target.organization_id} AND is_super_admin = true
  LIMIT 1
`

if (existing) {
  console.log(`Super admin already set for this org: ${existing.email}. No change.`)
  await sql.end()
  process.exit(0)
}

await sql`UPDATE users SET is_super_admin = true WHERE id = ${target.id}`
console.log(`Promoted ${target.email} to super admin.`)
await sql.end()
