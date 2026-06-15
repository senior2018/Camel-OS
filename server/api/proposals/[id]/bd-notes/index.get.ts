import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { proposalBdNotes, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  OPPORTUNITY_ATTACHMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  useSupabaseStorage,
} from '@@/server/utils/storage'

/** S13 (BD-02) — list the post-submission tracking log for a proposal. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const rows = await db
      .select({
        id: proposalBdNotes.id,
        kind: proposalBdNotes.kind,
        body: proposalBdNotes.body,
        createdAt: proposalBdNotes.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        attachmentStorageKey: proposalBdNotes.attachmentStorageKey,
        attachmentFileName: proposalBdNotes.attachmentFileName,
      })
      .from(proposalBdNotes)
      .leftJoin(users, eq(users.id, proposalBdNotes.createdByUserId))
      .where(eq(proposalBdNotes.proposalId, id))
      .orderBy(desc(proposalBdNotes.createdAt))

    const storage = useSupabaseStorage().storage.from(OPPORTUNITY_ATTACHMENTS_BUCKET)
    const notes = await Promise.all(
      rows.map(async ({ attachmentStorageKey, ...rest }) => {
        let attachmentUrl: string | null = null
        if (attachmentStorageKey) {
          const { data } = await storage.createSignedUrl(
            attachmentStorageKey,
            SIGNED_URL_TTL_SECONDS
          )
          attachmentUrl = data?.signedUrl ?? null
        }
        return { ...rest, attachmentUrl }
      })
    )

    return { notes }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing BD notes', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
