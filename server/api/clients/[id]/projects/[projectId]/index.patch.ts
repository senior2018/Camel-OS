import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { donorProjects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateDonorProjectSchema } from '@@/shared/schemas/project'

/**
 * CR-10 — Update an existing donor-project link's funding amount, currency, or
 * notes. The link itself (donor + project) is immutable; to change either side
 * delete and re-create.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const donorId = getRouterParam(event, 'id')
    const projectId = getRouterParam(event, 'projectId')
    if (!donorId || !projectId) {
      throw createError({ statusCode: 400, statusMessage: 'Donor + project ids are required' })
    }

    const parsed = updateDonorProjectSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid update payload',
      })
    }

    const db = useDrizzle()

    const updates: Partial<typeof donorProjects.$inferInsert> = {}
    if (parsed.data.fundingAmount !== undefined) {
      updates.fundingAmount = parsed.data.fundingAmount ?? null
    }
    if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes ?? null

    if (Object.keys(updates).length === 0) return { success: true }

    const [updated] = await db
      .update(donorProjects)
      .set(updates)
      .where(
        and(
          eq(donorProjects.donorId, donorId),
          eq(donorProjects.projectId, projectId),
          eq(donorProjects.organizationId, ctx.organizationId)
        )
      )
      .returning()

    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Link not found' })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'donor_project_updated',
      resourceId: donorId,
      meta: { projectId, fields: Object.keys(updates) },
    })

    return { success: true, link: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating donor-project link', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
