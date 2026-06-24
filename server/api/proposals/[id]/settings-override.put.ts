import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { isProposalLead } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'
import { updateProposalOverrideSchema } from '@@/shared/schemas/proposal-settings'

/**
 * P3.4-S3 — per-proposal override of the org's role catalogue and outcome
 * stages. `null` for a field clears the override (inherit the org default). The
 * Lead, a manager (proposal:admin) or a system admin may set it.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const payload = updateProposalOverrideSchema.parse(await readBody(event))

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id, opportunityId: proposals.opportunityId })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const canManage =
      ctx.isSystemAdmin ||
      (await isProposalLead(id, ctx.userId, ctx.isSystemAdmin)) ||
      (await userHasPermission(ctx.userId, 'proposal', 'admin'))
    if (!canManage) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the Lead or a manager can change proposal settings',
      })
    }

    // If roles are overridden, keep at least one Lead + unique keys.
    if (payload.roles) {
      const keys = new Set<string>()
      for (const r of payload.roles) {
        if (keys.has(r.key)) {
          throw createError({ statusCode: 400, statusMessage: `Duplicate role key: ${r.key}` })
        }
        keys.add(r.key)
      }
      if (!payload.roles.some((r) => r.behavior === 'lead')) {
        throw createError({ statusCode: 400, statusMessage: 'Keep at least one Lead role.' })
      }
    }

    await db
      .update(proposals)
      .set({
        rolesOverride: payload.roles,
        outcomeStagesOverride: payload.outcomeStages,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'settings_override_updated',
      resourceId: id,
      meta: { rolesOverridden: !!payload.roles, stagesOverridden: !!payload.outcomeStages },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating proposal settings override', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
