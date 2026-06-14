import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { proposalAttachments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  OPPORTUNITY_ATTACHMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  useSupabaseStorage,
} from '@@/server/utils/storage'

/** List a proposal's documents with short-lived signed download URLs. */
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
        id: proposalAttachments.id,
        fileName: proposalAttachments.fileName,
        storageKey: proposalAttachments.storageKey,
        fileSize: proposalAttachments.fileSize,
        mimeType: proposalAttachments.mimeType,
        brief: proposalAttachments.brief,
        createdAt: proposalAttachments.createdAt,
        uploadedByFirstName: users.firstName,
        uploadedByLastName: users.lastName,
      })
      .from(proposalAttachments)
      .leftJoin(users, eq(users.id, proposalAttachments.uploadedByUserId))
      .where(eq(proposalAttachments.proposalId, id))
      .orderBy(desc(proposalAttachments.createdAt))

    const storage = useSupabaseStorage().storage.from(OPPORTUNITY_ATTACHMENTS_BUCKET)
    const attachments = await Promise.all(
      rows.map(async (r) => {
        const { data } = await storage.createSignedUrl(r.storageKey, SIGNED_URL_TTL_SECONDS)
        const { storageKey, ...rest } = r
        return { ...rest, url: data?.signedUrl ?? null }
      })
    )

    return { attachments }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing proposal attachments', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
