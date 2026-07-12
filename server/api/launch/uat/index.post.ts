import { consola } from 'consola'
import { z } from 'zod'
import { uatCases } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'

const schema = z.object({
  module: z.string().trim().min(1).max(80),
  storyCode: z.string().trim().max(20).nullish(),
  title: z.string().trim().min(1).max(240),
})
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const b = await readValidatedBody(event, schema.parse)
    await useDrizzle()
      .insert(uatCases)
      .values({
        organizationId: ctx.organizationId,
        module: b.module,
        storyCode: b.storyCode ?? null,
        title: b.title,
        orderIndex: 999,
      })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error(error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
