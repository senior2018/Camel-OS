import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import dotenv from 'dotenv'
import consola from 'consola'

import * as schema from '../server/database/schema'
import { rolePermissions, roles } from '../server/database/schema'

dotenv.config()

/**
 * One-time backfill for the OM-08 refinement: grant `opportunity:approve` to the
 * "Manager" role in every organization that doesn't already have it.
 *
 * `ensureDefaultRoles()` only seeds *missing* roles, so an existing Manager role
 * won't pick up the new action automatically. System Administrators already pass
 * via their `opportunity:admin` grant, so only Manager needs the row. Idempotent.
 *
 * Run:  pnpm tsx ./scripts/grant-opportunity-approve.ts
 */
async function run() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client, { schema })

  const managerRoles = await db.select().from(roles).where(eq(roles.name, 'Manager'))
  let added = 0

  for (const role of managerRoles) {
    const [existing] = await db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, role.id),
          eq(rolePermissions.module, 'opportunity'),
          eq(rolePermissions.action, 'approve')
        )
      )
      .limit(1)
    if (existing) continue
    await db
      .insert(rolePermissions)
      .values({ roleId: role.id, module: 'opportunity', action: 'approve' })
    added++
  }

  consola.success(
    `opportunity:approve ensured on ${managerRoles.length} Manager role(s) — ${added} newly granted.`
  )
  await client.end()
  process.exit(0)
}

run().catch((err) => {
  consola.error(err)
  process.exit(1)
})
