import { consola } from 'consola'
import { z } from 'zod'
import { releaseNotes } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

const schema = z.object({
  version: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(20000).nullish(),
  highlights: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  releasedAt: z.string().trim().min(1),
  published: z.boolean().default(true),
})

/** HD-04 — publish a release note. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'create')
    const b = await readValidatedBody(event, schema.parse)
    const [created] = await useDrizzle()
      .insert(releaseNotes)
      .values({
        organizationId: ctx.organizationId,
        version: b.version,
        title: b.title,
        body: b.body ?? null,
        highlights: b.highlights,
        releasedAt: b.releasedAt,
        published: b.published,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, note: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating release note', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
