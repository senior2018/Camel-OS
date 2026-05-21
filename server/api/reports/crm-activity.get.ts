import { consola } from 'consola'
import { z } from 'zod'

import { requirePermission } from '@@/server/utils/permission-guard'
import { buildCrmActivityReport } from '@@/server/utils/crm-activity'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid from date'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid to date'),
  userId: z.string().uuid().optional(),
})

/**
 * CR-06 — JSON shape of the CRM activity report. The page reads this directly;
 * the CSV export uses the same builder so the two never disagree.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'read')
    const parsed = querySchema.safeParse(getQuery(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid query',
      })
    }
    const report = await buildCrmActivityReport(ctx.organizationId, parsed.data)
    return report
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building CRM activity report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
