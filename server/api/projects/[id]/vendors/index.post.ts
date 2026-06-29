import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projects, projectVendors } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { vendorSchema } from '@@/shared/schemas/project'

/** PJ-08 — add a vendor / subcontractor. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, vendorSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [created] = await db
      .insert(projectVendors)
      .values({
        projectId: id,
        organizationId: ctx.organizationId,
        name: body.name,
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail ? body.contactEmail : null,
        contractAmount: body.contractAmount != null ? String(body.contractAmount) : null,
        currency: body.currency,
        scope: body.scope ?? null,
        paymentSchedule: body.paymentSchedule ?? null,
      })
      .returning()
    return { success: true, vendor: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding vendor', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
