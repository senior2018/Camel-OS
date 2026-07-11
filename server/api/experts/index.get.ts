import { consola } from 'consola'
import { and, asc, eq, lte, or, ilike } from 'drizzle-orm'

import { expertProfiles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { EXPERT_AVAILABILITIES, type ExpertAvailability } from '@@/shared/schemas/hr'

/** EX-03 — search the Expert Database by skill, language, availability, rate. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const q = getQuery(event)
    const db = useDrizzle()

    const conds = [eq(expertProfiles.organizationId, ctx.organizationId)]
    const avail = String(q.availability ?? '')
    if (EXPERT_AVAILABILITIES.includes(avail as ExpertAvailability)) {
      conds.push(eq(expertProfiles.availability, avail as ExpertAvailability))
    }
    if (q.maxRate && !Number.isNaN(Number(q.maxRate))) {
      conds.push(lte(expertProfiles.dailyRate, String(Number(q.maxRate))))
    }
    if (q.q) {
      const like = `%${String(q.q)}%`
      conds.push(or(ilike(expertProfiles.headline, like), ilike(expertProfiles.summary, like))!)
    }

    const rows = await db
      .select({
        id: expertProfiles.id,
        userId: expertProfiles.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        headline: expertProfiles.headline,
        yearsExperience: expertProfiles.yearsExperience,
        dailyRate: expertProfiles.dailyRate,
        currency: expertProfiles.currency,
        availability: expertProfiles.availability,
        skills: expertProfiles.skills,
        languages: expertProfiles.languages,
        sectors: expertProfiles.sectors,
      })
      .from(expertProfiles)
      .leftJoin(users, eq(users.id, expertProfiles.userId))
      .where(and(...conds))
      .orderBy(asc(users.firstName))

    // Array-membership filters resolved in JS (small dataset, jsonb arrays).
    const skill = String(q.skill ?? '')
      .toLowerCase()
      .trim()
    const language = String(q.language ?? '')
      .toLowerCase()
      .trim()
    const sector = String(q.sector ?? '')
      .toLowerCase()
      .trim()
    const items = rows.filter((r) => {
      if (skill && !r.skills.some((s) => s.toLowerCase().includes(skill))) return false
      if (language && !r.languages.some((l) => l.language.toLowerCase().includes(language)))
        return false
      if (sector && !r.sectors.some((s) => s.toLowerCase().includes(sector))) return false
      return true
    })

    // Distinct skill/sector vocab to power filter suggestions.
    const allSkills = [...new Set(rows.flatMap((r) => r.skills))].sort()
    const allSectors = [...new Set(rows.flatMap((r) => r.sectors))].sort()
    return { items, facets: { skills: allSkills, sectors: allSectors } }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error searching experts', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
