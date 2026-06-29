import { consola } from 'consola'
import { inArray } from 'drizzle-orm'

import { users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { sendContentDecisionEmail, sendContentReviewRequestEmail } from './mailer'
import { createNotifications } from './notifications'

interface ContentForNotify {
  id: string
  title: string
  organizationId: string
}

function appUrl() {
  return (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
}
function fullName(u: { firstName: string | null; lastName: string | null; email: string }) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
}

/** CC-02 — notify newly-assigned reviewers by email + in-app. Best-effort. */
export async function notifyContentReviewers(
  content: ContentForNotify,
  requesterUserId: string,
  reviewerUserIds: string[]
): Promise<void> {
  if (!reviewerUserIds.length) return
  try {
    const db = useDrizzle()
    const ids = [...new Set([requesterUserId, ...reviewerUserIds])]
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, ids))
    const byId = new Map(rows.map((r) => [r.id, r]))
    const requester = byId.get(requesterUserId)
    const requesterName = requester ? fullName(requester) : 'A colleague'
    const url = `${appUrl()}/communications/${content.id}`

    await createNotifications(
      reviewerUserIds.map((uid) => ({
        organizationId: content.organizationId,
        userId: uid,
        type: 'content_review_request',
        title: `Review requested: ${content.title}`,
        body: `${requesterName} asked you to review this content.`,
        linkUrl: `/communications/${content.id}`,
      }))
    )

    await Promise.allSettled(
      reviewerUserIds.map((uid) => {
        const r = byId.get(uid)
        if (!r?.email) return Promise.resolve()
        return sendContentReviewRequestEmail(r.email, {
          recipientName: r.firstName || 'there',
          contentTitle: content.title,
          requesterName,
          url,
        })
      })
    )
  } catch (err) {
    consola.error('Failed to notify content reviewers', err)
  }
}

/** CC-03 — notify the author immediately when a reviewer decides. Best-effort. */
export async function notifyContentDecision(
  content: ContentForNotify,
  authorUserId: string | null,
  reviewerUserId: string,
  decision: string,
  comment: string | null
): Promise<void> {
  if (!authorUserId || authorUserId === reviewerUserId) return
  try {
    const db = useDrizzle()
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, [authorUserId, reviewerUserId]))
    const byId = new Map(rows.map((r) => [r.id, r]))
    const author = byId.get(authorUserId)
    const reviewer = byId.get(reviewerUserId)
    const reviewerName = reviewer ? fullName(reviewer) : 'A reviewer'

    await createNotifications([
      {
        organizationId: content.organizationId,
        userId: authorUserId,
        type: 'content_decision',
        title: `${reviewerName} reviewed: ${content.title}`,
        body:
          decision === 'approved'
            ? 'Approved.'
            : decision === 'rejected'
              ? 'Rejected.'
              : 'Changes requested.',
        linkUrl: `/communications/${content.id}`,
      },
    ])

    if (author?.email) {
      await sendContentDecisionEmail(author.email, {
        recipientName: author.firstName || 'there',
        contentTitle: content.title,
        decision,
        reviewerName,
        comment,
        url: `${appUrl()}/communications/${content.id}`,
      })
    }
  } catch (err) {
    consola.error('Failed to notify content author', err)
  }
}
