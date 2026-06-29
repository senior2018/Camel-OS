import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { stakeholders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateStakeholderSchema } from '@@/shared/schemas/communication'

/** Update a stakeholder profile / strategy / owner (CC-14/15). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const data = await readValidatedBody(event, updateStakeholderSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: stakeholders.id })
      .from(stakeholders)
      .where(and(eq(stakeholders.id, id), eq(stakeholders.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Stakeholder not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) updates.name = data.name
    if (data.type !== undefined) updates.type = data.type ?? null
    if (data.sector !== undefined) updates.sector = data.sector ?? null
    if (data.geography !== undefined) updates.geography = data.geography ?? null
    if (data.influence !== undefined) updates.influence = data.influence
    if (data.interest !== undefined) updates.interest = data.interest
    if (data.engagementStrategy !== undefined)
      updates.engagementStrategy = data.engagementStrategy ?? null
    if (data.ownerUserId !== undefined) updates.ownerUserId = data.ownerUserId ?? null

    const [updated] = await db
      .update(stakeholders)
      .set(updates)
      .where(eq(stakeholders.id, id))
      .returning()
    return { success: true, stakeholder: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating stakeholder', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
