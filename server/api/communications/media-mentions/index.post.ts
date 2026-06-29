import { consola } from 'consola'

import { mediaMentions } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createMediaMentionSchema } from '@@/shared/schemas/communication'

/** CC-18 — manually record a media mention. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const body = await readValidatedBody(event, createMediaMentionSchema.parse)
    const [created] = await useDrizzle()
      .insert(mediaMentions)
      .values({
        organizationId: ctx.organizationId,
        title: body.title,
        outlet: body.outlet ?? null,
        sourceType: body.sourceType,
        sentiment: body.sentiment,
        url: body.url ? body.url : null,
        mentionDate: body.mentionDate,
        summary: body.summary ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, mention: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating media mention', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
