import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { uatCases } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { UAT_STATUSES } from '@@/shared/schemas/launch'

const schema = z.object({
  status: z.enum(UAT_STATUSES).optional(),
  notes: z.string().trim().max(1000).nullish(),
})
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const b = await readValidatedBody(event, schema.parse)
    const set: Record<string, unknown> = {}
    if (b.status !== undefined) {
      set.status = b.status
      set.testedByUserId = ctx.userId
      set.testedAt = new Date()
    }
    if (b.notes !== undefined) set.notes = b.notes ?? null
    await useDrizzle()
      .update(uatCases)
      .set(set)
      .where(and(eq(uatCases.id, id), eq(uatCases.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error(error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
