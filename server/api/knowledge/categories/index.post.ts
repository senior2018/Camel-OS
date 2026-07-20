import { consola } from 'consola'
import { z } from 'zod'

import { knowledgeCategories } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullish(),
})

/** KM-02 — add a category (optionally nested under a parent). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'update')
    const b = await readValidatedBody(event, schema.parse)
    const [created] = await useDrizzle()
      .insert(knowledgeCategories)
      .values({
        organizationId: ctx.organizationId,
        name: b.name,
        parentId: b.parentId ?? null,
      })
      .returning({ id: knowledgeCategories.id })
    return { success: true, id: created?.id }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating knowledge category', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
