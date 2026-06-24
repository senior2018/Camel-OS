import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import dotenv from 'dotenv'
import consola from 'consola'

import * as schema from '../server/database/schema'
import { rolePermissions, roles } from '../server/database/schema'
import { DEFAULT_ROLES, expandDefaultPermissions } from '../shared/permissions'

dotenv.config()

/**
 * Additively syncs default-role permissions onto EXISTING roles.
 *
 * `ensureDefaultRoles()` only seeds roles that are missing, so when we add a new
 * default grant (e.g. Manager → opportunity:approve, proposal:admin) existing
 * orgs don't pick it up. This script, for every role whose name matches a
 * DEFAULT_ROLE, inserts any missing `(module, action)` rows. It NEVER removes a
 * permission, so deliberate admin edits are preserved.
 *
 * Run:  pnpm db:sync-perms
 */
async function run() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client, { schema })

  const defaultByName = new Map(DEFAULT_ROLES.map((d) => [d.name, d]))
  const allRoles = await db.select().from(roles)
  let added = 0

  for (const role of allRoles) {
    const def = defaultByName.get(role.name)
    if (!def) continue
    for (const { module, action } of expandDefaultPermissions(def)) {
      const [existing] = await db
        .select({ roleId: rolePermissions.roleId })
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, role.id),
            eq(rolePermissions.module, module),
            eq(rolePermissions.action, action)
          )
        )
        .limit(1)
      if (existing) continue
      await db.insert(rolePermissions).values({ roleId: role.id, module, action })
      added++
      consola.info(`+ ${role.name}: ${module}:${action}`)
    }
  }

  consola.success(
    `Permission sync complete — ${added} grant(s) added across ${allRoles.length} role(s).`
  )
  await client.end()
  process.exit(0)
}

run().catch((err) => {
  consola.error(err)
  process.exit(1)
})
