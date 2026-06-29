import { consola } from 'consola'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import { mediaMentions, rolePermissions, userRoles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createNotifications } from '@@/server/utils/notifications'
import { flagMentionSchema } from '@@/shared/schemas/communication'

/** CC-21 — flag a mention for escalation; managers get an in-app notification. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, flagMentionSchema.parse)
    const db = useDrizzle()

    const [mention] = await db
      .select({ id: mediaMentions.id, title: mediaMentions.title })
      .from(mediaMentions)
      .where(and(eq(mediaMentions.id, id), eq(mediaMentions.organizationId, ctx.organizationId)))
      .limit(1)
    if (!mention) throw createError({ statusCode: 404, statusMessage: 'Mention not found' })

    await db
      .update(mediaMentions)
      .set({
        flagged: true,
        escalationNote: body.escalationNote,
        flaggedByUserId: ctx.userId,
        flaggedAt: new Date(),
      })
      .where(eq(mediaMentions.id, id))

    // Notify management (anyone who can approve/administer communications).
    const managers = await db
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(
        and(
          eq(users.organizationId, ctx.organizationId),
          isNull(users.deactivatedAt),
          eq(rolePermissions.module, 'communications'),
          inArray(rolePermissions.action, ['approve', 'admin'])
        )
      )
    await createNotifications(
      managers
        .filter((m) => m.id !== ctx.userId)
        .map((m) => ({
          organizationId: ctx.organizationId,
          userId: m.id,
          type: 'media_escalation',
          title: `Media mention escalated: ${mention.title}`,
          body: body.escalationNote,
          linkUrl: '/media',
        }))
    )

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'update',
      resourceId: id,
      meta: { event: 'media_escalated' },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error flagging mention', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
