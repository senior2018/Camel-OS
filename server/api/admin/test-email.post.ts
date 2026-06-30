import { consola } from 'consola'
import { z } from 'zod'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { sendTestEmail } from '@@/server/utils/mailer'

const bodySchema = z.object({ to: z.string().email().optional() })

/**
 * Admin email diagnostic — sends a test message and reports the real outcome
 * (messageId on success, the provider error on failure) instead of swallowing
 * it. Lets admins verify Brevo from the live app without server access.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const body = await readValidatedBody(event, bodySchema.parse).catch(() => ({ to: undefined }))
    const to = body.to || admin.email
    const fromEmail = (useRuntimeConfig().brevoFromEmail as string) || 'noreply@camel-os.com'

    try {
      const messageId = await sendTestEmail(to)
      await logAuditEvent({
        organizationId: admin.organizationId,
        userId: admin.userId,
        resource: 'admin',
        action: 'test_email_sent',
        resourceId: null,
        meta: { to, fromEmail, messageId },
      })
      return { success: true, to, fromEmail, messageId }
    } catch (mailErr) {
      const message = (mailErr as Error).message
      consola.error('Test email failed', mailErr)
      return { success: false, to, fromEmail, error: message }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in test-email endpoint', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
