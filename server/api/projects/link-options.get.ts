import { consola } from 'consola'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { clients, projects, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * P4 — options for linking a project to its origin proposal and to a
 * client/donor/partner. Deliberately lightweight (id + label only); used by the
 * project edit form's pickers.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const db = useDrizzle()

    const clientRows = await db
      .select({ id: clients.id, name: clients.name, type: clients.type })
      .from(clients)
      .where(eq(clients.organizationId, ctx.organizationId))
      .orderBy(asc(clients.name))

    // Won/eligible proposals that aren't already tied to a project — plus we let
    // the current project keep its own link (handled client-side).
    const proposalRows = await db
      .select({ id: proposals.id, title: proposals.title, status: proposals.status })
      .from(proposals)
      .leftJoin(projects, eq(projects.proposalId, proposals.id))
      .where(and(eq(proposals.organizationId, ctx.organizationId), isNull(projects.id)))
      .orderBy(asc(proposals.title))

    return { clients: clientRows, proposals: proposalRows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading project link options', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
