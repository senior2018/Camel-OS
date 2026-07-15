import { consola } from 'consola'
import { and, eq, isNotNull, lte, ne, sql } from 'drizzle-orm'

import {
  certifications,
  jobVacancies,
  leaveRequests,
  performanceReviews,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * Counts of items needing attention, for the People page action-card badges:
 * leave awaiting approval, certs expiring within 60 days, open vacancies, and
 * reviews still in progress. Cheap COUNT(*)s scoped to the org.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const db = useDrizzle()
    const org = ctx.organizationId
    const soon = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)

    const [pendingLeave] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.organizationId, org), eq(leaveRequests.status, 'pending')))
    const [expiringCerts] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(certifications)
      .where(
        and(
          eq(certifications.organizationId, org),
          isNotNull(certifications.expiryDate),
          lte(certifications.expiryDate, soon)
        )
      )
    const [openVacancies] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(jobVacancies)
      .where(and(eq(jobVacancies.organizationId, org), eq(jobVacancies.status, 'open')))
    const [activeReviews] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(performanceReviews)
      .where(
        and(eq(performanceReviews.organizationId, org), ne(performanceReviews.status, 'completed'))
      )

    return {
      pendingLeave: pendingLeave?.n ?? 0,
      expiringCerts: expiringCerts?.n ?? 0,
      openVacancies: openVacancies?.n ?? 0,
      activeReviews: activeReviews?.n ?? 0,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building HR summary', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
