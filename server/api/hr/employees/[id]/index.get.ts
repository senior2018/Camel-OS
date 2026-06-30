import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { certifications, employeeProfiles, leaveRequests, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HR-01 — full personnel file for one user (id = userId): profile, leave, certs. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const userId = getRouterParam(event, 'id')
    if (!userId) throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
    const db = useDrizzle()

    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Employee not found' })

    const [profile] = await db
      .select()
      .from(employeeProfiles)
      .where(eq(employeeProfiles.userId, userId))
      .limit(1)

    const leave = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.userId, userId))
      .orderBy(desc(leaveRequests.startDate))

    const certs = await db
      .select()
      .from(certifications)
      .where(eq(certifications.userId, userId))
      .orderBy(desc(certifications.expiryDate))

    return { user, profile: profile ?? null, leave, certifications: certs }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading personnel file', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
