import { consola } from 'consola'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { getPasswordPolicy } from '@@/server/utils/password-policy'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const policy = await getPasswordPolicy(admin.organizationId)
    return { policy }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching password policy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
