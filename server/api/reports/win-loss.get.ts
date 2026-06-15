import { consola } from 'consola'

import { requirePermission } from '@@/server/utils/permission-guard'
import { buildWinLossReport } from '@@/server/utils/win-loss'

/**
 * BD-03 — Win/loss analysis. See `buildWinLossReport` for the aggregation.
 * Filterable by decided-date period (?from=YYYY-MM-DD&to=YYYY-MM-DD).
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const q = getQuery(event)
    const from = typeof q.from === 'string' && q.from ? q.from : null
    const to = typeof q.to === 'string' && q.to ? q.to : null

    return await buildWinLossReport(ctx.organizationId, { from, to })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building win/loss report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
