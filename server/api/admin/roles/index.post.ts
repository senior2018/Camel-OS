import { consola } from 'consola'

import { rolePermissions, roles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { upsertRoleSchema } from '@@/shared/schemas/role'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)

    const parsed = upsertRoleSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid role payload' })
    }

    const { name, description, mfaRequired, permissions } = parsed.data
    const db = useDrizzle()

    const created = await db.transaction(async (tx) => {
      const [createdRole] = await tx
        .insert(roles)
        .values({
          organizationId: admin.organizationId,
          name,
          description: description ?? null,
          mfaRequired: mfaRequired ?? false,
          isSystem: false,
        })
        .returning()

      if (!createdRole) throw new Error('Failed to create role')

      if (permissions.length > 0) {
        // Deduplicate (module, action) tuples in case the client sent any repeats.
        const seen = new Set<string>()
        const rows = permissions.flatMap((p) => {
          const key = `${p.module}:${p.action}`
          if (seen.has(key)) return []
          seen.add(key)
          return [{ roleId: createdRole.id, module: p.module, action: p.action }]
        })
        if (rows.length > 0) await tx.insert(rolePermissions).values(rows)
      }

      return createdRole
    })

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'role',
      action: 'create',
      resourceId: created.id,
      meta: { name, permissionCount: permissions.length },
    })

    return { success: true, role: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    if (error instanceof Error && /unique/i.test(error.message)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A role with this name already exists',
      })
    }
    consola.error('Error creating role', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
