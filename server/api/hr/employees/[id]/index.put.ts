import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { employeeProfiles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { employeeProfileUpdateSchema } from '@@/shared/schemas/hr'

/** HR-01 — create/update the personnel file for a user (id = userId, upsert). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const userId = getRouterParam(event, 'id')
    if (!userId) throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
    const body = await readValidatedBody(event, employeeProfileUpdateSchema.parse)
    const db = useDrizzle()

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Employee not found' })

    const values = {
      ...body,
      managerUserId: body.managerUserId ?? null,
      baseSalary: body.baseSalary != null ? String(body.baseSalary) : null,
      annualLeaveEntitlement:
        body.annualLeaveEntitlement != null ? String(body.annualLeaveEntitlement) : undefined,
      organizationId: ctx.organizationId,
      userId,
      updatedAt: new Date(),
    }

    const [saved] = await db
      .insert(employeeProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: employeeProfiles.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning()
    return { success: true, profile: saved }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving personnel file', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
