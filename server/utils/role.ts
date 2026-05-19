import { and, eq, inArray } from 'drizzle-orm'

import { rolePermissions, roles, userRoles } from '../database/schema'
import { useDrizzle } from './drizzle'
import {
  DEFAULT_ROLES,
  expandDefaultPermissions,
  type PermissionAction,
} from '@@/shared/permissions'

/**
 * Idempotent: creates any missing default role for the given organization and
 * back-fills its permission rows. Existing roles (by name) are left untouched so
 * admin edits are preserved. Safe to call on every server boot or org creation.
 */
export async function ensureDefaultRoles(organizationId: string): Promise<void> {
  const db = useDrizzle()

  const existing = await db
    .select({ name: roles.name })
    .from(roles)
    .where(eq(roles.organizationId, organizationId))

  const existingNames = new Set(existing.map((r) => r.name))
  const missing = DEFAULT_ROLES.filter((def) => !existingNames.has(def.name))
  if (missing.length === 0) return

  await db.transaction(async (tx) => {
    for (const def of missing) {
      const [inserted] = await tx
        .insert(roles)
        .values({
          organizationId,
          name: def.name,
          description: def.description,
          mfaRequired: def.mfaRequired,
          isSystem: def.isSystem,
        })
        .returning({ id: roles.id })

      if (!inserted) throw new Error(`Failed to seed default role: ${def.name}`)

      const rows = expandDefaultPermissions(def).map((p) => ({
        roleId: inserted.id,
        module: p.module,
        action: p.action,
      }))
      if (rows.length > 0) {
        await tx.insert(rolePermissions).values(rows)
      }
    }
  })
}

/**
 * Returns the union of every permission granted to a user via their assigned roles,
 * keyed by `${module}:${action}`. Empty set means the user has no permissions yet.
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const rows = await useDrizzle()
    .select({ module: rolePermissions.module, action: rolePermissions.action })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(eq(userRoles.userId, userId))

  return new Set(rows.map((r) => `${r.module}:${r.action}`))
}

/**
 * Convenience check that returns true when any of the user's roles grants the
 * requested module:action pair (or the 'admin' meta-action on that module).
 */
export async function userHasPermission(
  userId: string,
  module: string,
  action: PermissionAction
): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms.has(`${module}:${action}`) || perms.has(`${module}:admin`)
}

/**
 * True when any role assigned to the user has `mfaRequired = true`. Used by the
 * login flow to force unset-MFA users into the setup screen before they can
 * access the app.
 */
export async function userRequiresMfa(userId: string): Promise<boolean> {
  const rows = await useDrizzle()
    .select({ mfaRequired: roles.mfaRequired })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))

  return rows.some((r) => r.mfaRequired)
}

/**
 * Returns the IDs of roles assigned to a user, filtered to the given organization
 * for safety (a role only ever belongs to one org via its FK).
 */
export async function getUserRoleIds(userId: string, organizationId: string): Promise<string[]> {
  const rows = await useDrizzle()
    .select({ roleId: userRoles.roleId, organizationId: roles.organizationId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))

  return rows.filter((r) => r.organizationId === organizationId).map((r) => r.roleId)
}

/**
 * Replaces a user's roles atomically. Caller is expected to have verified that all
 * `roleIds` belong to the same organization as the target user.
 */
export async function setUserRoles(
  userId: string,
  roleIds: string[],
  assignedByUserId: string | null
): Promise<void> {
  await useDrizzle().transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId))
    if (roleIds.length === 0) return
    await tx.insert(userRoles).values(
      roleIds.map((roleId) => ({
        userId,
        roleId,
        assignedByUserId,
      }))
    )
  })
}

/**
 * Returns roles in the given organization whose IDs match the provided list — used
 * to validate that role IDs submitted by a client are scoped to the admin's org.
 */
export async function findRolesInOrg(organizationId: string, roleIds: string[]) {
  if (roleIds.length === 0) return []
  return useDrizzle()
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.organizationId, organizationId), inArray(roles.id, roleIds)))
}
