import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { employeeProfiles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HR-01 — staff directory: every org user with their personnel-file summary. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const rows = await useDrizzle()
      .select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileId: employeeProfiles.id,
        employeeNumber: employeeProfiles.employeeNumber,
        jobTitle: employeeProfiles.jobTitle,
        department: employeeProfiles.department,
        employmentType: employeeProfiles.employmentType,
        status: employeeProfiles.status,
        startDate: employeeProfiles.startDate,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .where(eq(users.organizationId, ctx.organizationId))
      .orderBy(asc(users.firstName), asc(users.lastName))
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing employees', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
