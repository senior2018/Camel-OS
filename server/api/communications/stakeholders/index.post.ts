import { consola } from 'consola'

import { stakeholders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createStakeholderSchema } from '@@/shared/schemas/communication'

/** CC-14 — create a stakeholder profile. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const body = await readValidatedBody(event, createStakeholderSchema.parse)
    const [created] = await useDrizzle()
      .insert(stakeholders)
      .values({
        organizationId: ctx.organizationId,
        name: body.name,
        type: body.type ?? null,
        sector: body.sector ?? null,
        geography: body.geography ?? null,
        influence: body.influence,
        interest: body.interest,
        engagementStrategy: body.engagementStrategy ?? null,
        ownerUserId: body.ownerUserId ?? ctx.userId,
      })
      .returning()
    return { success: true, stakeholder: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating stakeholder', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
