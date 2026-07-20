import { consola } from 'consola'
import { and, eq, isNotNull, lte, or, sql } from 'drizzle-orm'

import { knowledgeArticles, rolePermissions, userRoles, users } from '@@/server/database/schema'
import { useDrizzle } from './drizzle'
import { createNotifications } from './notifications'

/**
 * KM-06 — alert knowledge managers about articles whose review date is within
 * 30 days (or already overdue) and that haven't been reminded since the article
 * was last updated. Each article is reminded once per review cycle via the
 * `review_reminder_sent_at` stamp (cleared whenever the review date changes).
 */
export async function sendKnowledgeReviewReminders(
  reference?: Date
): Promise<{ articles: number; reminded: number }> {
  const db = useDrizzle()
  const now = reference ?? new Date()
  const horizon = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)

  const due = await db
    .select({
      id: knowledgeArticles.id,
      organizationId: knowledgeArticles.organizationId,
      title: knowledgeArticles.title,
      nextReviewDate: knowledgeArticles.nextReviewDate,
    })
    .from(knowledgeArticles)
    .where(
      and(
        eq(knowledgeArticles.status, 'published'),
        isNotNull(knowledgeArticles.nextReviewDate),
        lte(knowledgeArticles.nextReviewDate, horizon),
        // Not yet reminded, or reminded before the article's last update.
        or(
          sql`${knowledgeArticles.reviewReminderSentAt} IS NULL`,
          sql`${knowledgeArticles.reviewReminderSentAt} < ${knowledgeArticles.updatedAt}`
        )
      )
    )
  if (!due.length) return { articles: 0, reminded: 0 }

  // Knowledge managers per org = users whose role grants knowledge:update.
  const managers = await db
    .selectDistinct({
      userId: userRoles.userId,
      organizationId: users.organizationId,
    })
    .from(rolePermissions)
    .innerJoin(userRoles, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(rolePermissions.module, 'knowledge'), eq(rolePermissions.action, 'update')))
  const managersByOrg = new Map<string, string[]>()
  for (const m of managers) {
    if (!managersByOrg.has(m.organizationId)) managersByOrg.set(m.organizationId, [])
    managersByOrg.get(m.organizationId)!.push(m.userId)
  }

  let reminded = 0
  for (const a of due) {
    const mgrs = managersByOrg.get(a.organizationId) ?? []
    const overdue = a.nextReviewDate! < now.toISOString().slice(0, 10)
    await createNotifications(
      mgrs.map((userId) => ({
        organizationId: a.organizationId,
        userId,
        type: 'knowledge_review_due',
        title: overdue
          ? `Knowledge article overdue for review`
          : `Knowledge article due for review`,
        body: `"${a.title}" ${overdue ? 'was due' : 'is due'} for review on ${a.nextReviewDate}.`,
        linkUrl: `/knowledge/${a.id}`,
      }))
    )
    reminded += mgrs.length
  }
  await db
    .update(knowledgeArticles)
    .set({ reviewReminderSentAt: now })
    .where(
      sql`${knowledgeArticles.id} IN (${sql.join(
        due.map((d) => sql`${d.id}`),
        sql`, `
      )})`
    )

  consola.info('[knowledge-review-reminders]', { articles: due.length, reminded })
  return { articles: due.length, reminded }
}
