import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { expertProfiles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { expertProfileUpdateSchema } from '@@/shared/schemas/hr'

/** EX-01 / EX-02 — create/update an expert profile (id = userId, upsert). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const userId = getRouterParam(event, 'id')
    if (!userId) throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
    const body = await readValidatedBody(event, expertProfileUpdateSchema.parse)
    const db = useDrizzle()

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Expert not found' })

    const values = {
      organizationId: ctx.organizationId,
      userId,
      headline: body.headline ?? null,
      summary: body.summary ?? null,
      yearsExperience: body.yearsExperience ?? null,
      dailyRate: body.dailyRate != null ? String(body.dailyRate) : null,
      currency: body.currency,
      availability: body.availability,
      skills: body.skills,
      languages: body.languages,
      sectors: body.sectors,
      countries: body.countries,
      education: body.education,
      experience: body.experience,
      linkedinUrl: body.linkedinUrl || null,
      updatedAt: new Date(),
    }

    const [saved] = await db
      .insert(expertProfiles)
      .values(values)
      .onConflictDoUpdate({ target: expertProfiles.userId, set: values })
      .returning()
    return { success: true, profile: saved }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving expert profile', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
