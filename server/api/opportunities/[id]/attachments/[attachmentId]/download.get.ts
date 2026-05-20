import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunityAttachments } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  OPPORTUNITY_ATTACHMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  useSupabaseStorage,
} from '@@/server/utils/storage'

/**
 * Issues a short-lived signed URL for downloading an attachment. We never hand
 * back the raw storage path so the bucket can stay private; the URL expires in
 * `SIGNED_URL_TTL_SECONDS` (5 min) which is plenty for a click-to-download flow.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const opportunityId = getRouterParam(event, 'id')
    const attachmentId = getRouterParam(event, 'attachmentId')

    if (!opportunityId || !attachmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request' })
    }

    const [attachment] = await useDrizzle()
      .select()
      .from(opportunityAttachments)
      .where(
        and(
          eq(opportunityAttachments.id, attachmentId),
          eq(opportunityAttachments.opportunityId, opportunityId),
          eq(opportunityAttachments.organizationId, ctx.organizationId)
        )
      )
      .limit(1)

    if (!attachment) {
      throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
    }

    const { data, error } = await useSupabaseStorage()
      .storage.from(OPPORTUNITY_ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.storagePath, SIGNED_URL_TTL_SECONDS, {
        download: attachment.fileName,
      })

    if (error || !data?.signedUrl) {
      consola.error('Signed URL generation failed', error)
      throw createError({ statusCode: 500, statusMessage: 'Could not generate download link' })
    }

    return { url: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error issuing signed URL', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
