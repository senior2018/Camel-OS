import { consola } from 'consola'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { roles, userInvitations, userRoles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const db = useDrizzle()

    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        status: users.status,
        deactivatedAt: users.deactivatedAt,
        emailVerifiedAt: users.emailVerifiedAt,
        lockedUntil: users.lockedUntil,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.organizationId, admin.organizationId))
      .orderBy(desc(users.createdAt))

    // Single query for every assigned role in the org; we group in JS to avoid an
    // N+1 round-trip per user.
    const roleRows = await db
      .select({
        userId: userRoles.userId,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(roles.organizationId, admin.organizationId))

    const rolesByUser = new Map<string, Array<{ id: string; name: string }>>()
    for (const row of roleRows) {
      const list = rolesByUser.get(row.userId) ?? []
      list.push({ id: row.roleId, name: row.roleName })
      rolesByUser.set(row.userId, list)
    }

    const usersWithRoles = userRows.map((u) => ({
      ...u,
      roles: rolesByUser.get(u.id) ?? [],
    }))

    const pendingInvites = await db
      .select({
        id: userInvitations.id,
        email: userInvitations.email,
        firstName: userInvitations.firstName,
        lastName: userInvitations.lastName,
        expiresAt: userInvitations.expiresAt,
        createdAt: userInvitations.createdAt,
        roleId: userInvitations.roleId,
      })
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.organizationId, admin.organizationId),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt)
        )
      )
      .orderBy(desc(userInvitations.createdAt))

    return { users: usersWithRoles, pendingInvitations: pendingInvites }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing admin users', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
