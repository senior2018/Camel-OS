import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { projectMembers, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createNotifications } from '@@/server/utils/notifications'
import { projectMemberSchema } from '@@/shared/schemas/project'

const bodySchema = z.object({ members: z.array(projectMemberSchema).max(50) })

/** PJ-02 — set the project team (roles + allocation). Notifies new members. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, bodySchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const seen = new Set<string>()
    for (const m of body.members) {
      if (seen.has(m.userId))
        throw createError({ statusCode: 400, statusMessage: 'A person was listed twice.' })
      seen.add(m.userId)
    }

    const prior = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, id))
    const priorIds = new Set(prior.map((p) => p.userId))

    await db.delete(projectMembers).where(eq(projectMembers.projectId, id))
    if (body.members.length) {
      await db.insert(projectMembers).values(
        body.members.map((m) => ({
          projectId: id,
          organizationId: ctx.organizationId,
          userId: m.userId,
          role: m.role,
          allocationPct: m.allocationPct,
        }))
      )
    }

    const newcomers = body.members.filter((m) => !priorIds.has(m.userId) && m.userId !== ctx.userId)
    await createNotifications(
      newcomers.map((m) => ({
        organizationId: ctx.organizationId,
        userId: m.userId,
        type: 'project_member_added',
        title: `Added to "${project.name}"`,
        body: `You've been assigned as ${m.role}.`,
        linkUrl: `/projects/${id}`,
      }))
    )

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving project team', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
