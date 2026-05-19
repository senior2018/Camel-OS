import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { rolePermissions, roles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { upsertRoleSchema } from '@@/shared/schemas/role'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const roleId = getRouterParam(event, 'id')
    if (!roleId) {
      throw createError({ statusCode: 400, statusMessage: 'Role id is required' })
    }

    const parsed = upsertRoleSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid role payload' })
    }

    const { name, description, mfaRequired, permissions } = parsed.data
    const db = useDrizzle()
    const now = new Date()

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.id, roleId), eq(roles.organizationId, admin.organizationId)))
        .limit(1)

      if (!existing) {
        throw createError({ statusCode: 404, statusMessage: 'Role not found' })
      }

      // System roles can have their permissions edited but not be renamed or
      // converted to non-system, to keep the seeded set stable across reboots.
      const nextName = existing.isSystem ? existing.name : name

      const [updated] = await tx
        .update(roles)
        .set({
          name: nextName,
          description: description ?? null,
          mfaRequired: mfaRequired ?? false,
          updatedAt: now,
        })
        .where(eq(roles.id, roleId))
        .returning()

      // Replace permissions wholesale — simpler and predictable from the client.
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
      if (permissions.length > 0) {
        const seen = new Set<string>()
        const rows = permissions.flatMap((p) => {
          const key = `${p.module}:${p.action}`
          if (seen.has(key)) return []
          seen.add(key)
          return [{ roleId, module: p.module, action: p.action }]
        })
        if (rows.length > 0) await tx.insert(rolePermissions).values(rows)
      }

      return updated
    })

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'role',
      action: 'update',
      resourceId: roleId,
      meta: { permissionCount: permissions.length },
    })

    return { success: true, role: result }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    if (error instanceof Error && /unique/i.test(error.message)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A role with this name already exists',
      })
    }
    consola.error('Error updating role', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
