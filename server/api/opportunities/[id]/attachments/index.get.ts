import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { opportunities, opportunityAttachments, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const opportunityId = getRouterParam(event, 'id')
    if (!opportunityId) {
      throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })
    }

    const db = useDrizzle()

    // Defence-in-depth: confirm the opportunity belongs to the caller's org.
    const [opp] = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, opportunityId),
          eq(opportunities.organizationId, ctx.organizationId)
        )
      )
      .limit(1)

    if (!opp) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    const rows = await db
      .select({
        id: opportunityAttachments.id,
        fileName: opportunityAttachments.fileName,
        mimeType: opportunityAttachments.mimeType,
        sizeBytes: opportunityAttachments.sizeBytes,
        createdAt: opportunityAttachments.createdAt,
        uploadedByUserId: opportunityAttachments.uploadedByUserId,
        uploadedByEmail: users.email,
        uploadedByFirstName: users.firstName,
        uploadedByLastName: users.lastName,
      })
      .from(opportunityAttachments)
      .leftJoin(users, eq(users.id, opportunityAttachments.uploadedByUserId))
      .where(eq(opportunityAttachments.opportunityId, opportunityId))
      .orderBy(desc(opportunityAttachments.createdAt))

    return { attachments: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing attachments', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
