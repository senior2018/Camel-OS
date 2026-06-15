import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { proposalSectionVersions, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PM-03 — save-history for a section, newest first. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    const sectionId = getRouterParam(event, 'sectionId')
    if (!id || !sectionId) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal and section ID are required' })
    }

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const versions = await db
      .select({
        id: proposalSectionVersions.id,
        title: proposalSectionVersions.title,
        body: proposalSectionVersions.body,
        createdAt: proposalSectionVersions.createdAt,
        savedByFirstName: users.firstName,
        savedByLastName: users.lastName,
      })
      .from(proposalSectionVersions)
      .leftJoin(users, eq(users.id, proposalSectionVersions.savedByUserId))
      .where(
        and(
          eq(proposalSectionVersions.sectionId, sectionId),
          eq(proposalSectionVersions.proposalId, id)
        )
      )
      .orderBy(desc(proposalSectionVersions.createdAt))
      .limit(50)

    return { versions }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing section versions', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
