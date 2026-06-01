import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clients, donorProjects, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { linkDonorProjectSchema } from '@@/shared/schemas/project'

/**
 * CR-10 — Link a donor (client of type 'donor') to a project. The pivot row
 * carries the donor's funding amount and currency for this specific project.
 * Re-linking the same donor+project is rejected; clients call PATCH to change
 * the funding numbers.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const donorId = getRouterParam(event, 'id')
    if (!donorId) throw createError({ statusCode: 400, statusMessage: 'Donor id is required' })

    const parsed = linkDonorProjectSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid link payload',
      })
    }

    const db = useDrizzle()

    const [donor] = await db
      .select({ id: clients.id, type: clients.type })
      .from(clients)
      .where(and(eq(clients.id, donorId), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)
    if (!donor) throw createError({ statusCode: 404, statusMessage: 'Donor not found' })

    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(eq(projects.id, parsed.data.projectId), eq(projects.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [existing] = await db
      .select({ donorId: donorProjects.donorId })
      .from(donorProjects)
      .where(
        and(eq(donorProjects.donorId, donorId), eq(donorProjects.projectId, parsed.data.projectId))
      )
      .limit(1)
    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This donor is already linked to that project',
      })
    }

    const [created] = await db
      .insert(donorProjects)
      .values({
        donorId,
        projectId: parsed.data.projectId,
        organizationId: ctx.organizationId,
        fundingAmount: parsed.data.fundingAmount ?? null,
        currency: parsed.data.currency,
        notes: parsed.data.notes ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'donor_project_linked',
      resourceId: donorId,
      meta: {
        projectId: parsed.data.projectId,
        projectName: project.name,
        fundingAmount: created?.fundingAmount,
        currency: created?.currency,
      },
    })

    return { success: true, link: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error linking donor to project', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
