import { consola } from 'consola'
import { eq } from 'drizzle-orm'

import { expertProfiles, projectMembers } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { EXPERT_AVAILABILITIES, type ExpertAvailability } from '@@/shared/schemas/hr'

/** EX-08 — Expert Database utilisation report. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const db = useDrizzle()

    const profiles = await db
      .select({
        userId: expertProfiles.userId,
        availability: expertProfiles.availability,
        dailyRate: expertProfiles.dailyRate,
        skills: expertProfiles.skills,
      })
      .from(expertProfiles)
      .where(eq(expertProfiles.organizationId, ctx.organizationId))

    const members = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.organizationId, ctx.organizationId))
    const assignedIds = new Set(members.map((m) => m.userId))

    const total = profiles.length
    const assigned = profiles.filter((p) => assignedIds.has(p.userId)).length
    const byAvailability = Object.fromEntries(
      EXPERT_AVAILABILITIES.map((a) => [a, profiles.filter((p) => p.availability === a).length])
    ) as Record<ExpertAvailability, number>

    const rates = profiles.map((p) => Number(p.dailyRate)).filter((n) => n > 0)
    const avgRate = rates.length ? Math.round(rates.reduce((s, n) => s + n, 0) / rates.length) : 0

    const skillCount = new Map<string, number>()
    for (const p of profiles)
      for (const s of p.skills) skillCount.set(s, (skillCount.get(s) ?? 0) + 1)
    const topSkills = [...skillCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([skill, count]) => ({ skill, count }))

    return {
      total,
      assigned,
      utilisation: total ? Math.round((assigned / total) * 100) : 0,
      byAvailability,
      avgRate,
      topSkills,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building utilisation report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
