import { consola } from 'consola'
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'

import { mediaMentions, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'
import { MEDIA_SENTIMENTS, MEDIA_SOURCE_TYPES } from '@@/shared/schemas/communication'

/** CC-18/CC-20 — media mentions list + monitoring dashboard aggregates. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const q = getQuery(event)
    const db = useDrizzle()

    const conds = [eq(mediaMentions.organizationId, ctx.organizationId)]
    if (q.q) {
      const like = `%${String(q.q)}%`
      conds.push(
        or(
          ilike(mediaMentions.title, like),
          ilike(mediaMentions.outlet, like),
          ilike(mediaMentions.summary, like)
        )!
      )
    }
    if (q.sourceType && MEDIA_SOURCE_TYPES.includes(String(q.sourceType) as never))
      conds.push(eq(mediaMentions.sourceType, String(q.sourceType) as never))
    if (q.sentiment && MEDIA_SENTIMENTS.includes(String(q.sentiment) as never))
      conds.push(eq(mediaMentions.sentiment, String(q.sentiment) as never))
    if (q.from) conds.push(gte(mediaMentions.mentionDate, String(q.from)))
    if (q.to) conds.push(lte(mediaMentions.mentionDate, String(q.to)))

    const rows = await db
      .select({
        id: mediaMentions.id,
        title: mediaMentions.title,
        outlet: mediaMentions.outlet,
        sourceType: mediaMentions.sourceType,
        sentiment: mediaMentions.sentiment,
        url: mediaMentions.url,
        mentionDate: mediaMentions.mentionDate,
        summary: mediaMentions.summary,
        flagged: mediaMentions.flagged,
        escalationNote: mediaMentions.escalationNote,
        flaggedByFirstName: users.firstName,
        flaggedByLastName: users.lastName,
      })
      .from(mediaMentions)
      .leftJoin(users, eq(users.id, mediaMentions.flaggedByUserId))
      .where(and(...conds))
      .orderBy(desc(mediaMentions.mentionDate))
      .limit(500)

    // Aggregates (CC-20) over the filtered set.
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
    const outletMap: Record<string, number> = {}
    const volumeMap: Record<string, number> = {}
    for (const m of rows) {
      sentimentCounts[m.sentiment] += 1
      if (m.outlet) outletMap[m.outlet] = (outletMap[m.outlet] ?? 0) + 1
      volumeMap[m.mentionDate] = (volumeMap[m.mentionDate] ?? 0) + 1
    }
    const topSources = Object.entries(outletMap)
      .map(([outlet, count]) => ({ outlet, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
    const volume = Object.entries(volumeMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      items: rows,
      summary: { total: rows.length, sentimentCounts, topSources, volume },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing media mentions', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
