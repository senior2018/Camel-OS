import type { H3Event } from 'h3'

import { requireUser } from './permission-guard'
import { userHasPermission } from './role'
import type { PermissionContext } from './permission-guard'

/**
 * Gate the Communications *workspace* (drafts, review, the pipeline) to the
 * content team — anyone who can create / update / approve / administer content.
 * Plain `communications:read` (every staff member, for the library) is NOT
 * enough to see unpublished work.
 */
export async function requireContentTeam(event: H3Event): Promise<PermissionContext> {
  const ctx = await requireUser(event)
  if (ctx.isSystemAdmin) return ctx
  const ok =
    (await userHasPermission(ctx.userId, 'communications', 'create')) ||
    (await userHasPermission(ctx.userId, 'communications', 'update')) ||
    (await userHasPermission(ctx.userId, 'communications', 'approve'))
  if (!ok) {
    throw createError({
      statusCode: 403,
      statusMessage: "You don't have access to the Communications workspace.",
    })
  }
  return ctx
}
