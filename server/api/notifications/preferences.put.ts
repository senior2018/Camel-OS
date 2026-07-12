import { consola } from 'consola'
import { z } from 'zod'
import { notificationPreferences } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { DIGEST_FREQUENCIES } from '@@/shared/schemas/notifications'

const schema = z.object({
  emailByCategory: z.record(z.string(), z.boolean()),
  digestFrequency: z.enum(DIGEST_FREQUENCIES),
})

/** NT-02 — save notification preferences. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const b = await readValidatedBody(event, schema.parse)
    const row = {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      emailByCategory: b.emailByCategory,
      digestFrequency: b.digestFrequency,
      updatedAt: new Date(),
    }
    await useDrizzle()
      .insert(notificationPreferences)
      .values(row)
      .onConflictDoUpdate({ target: notificationPreferences.userId, set: row })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving preferences', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
