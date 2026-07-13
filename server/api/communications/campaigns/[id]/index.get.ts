import { consola } from 'consola'
import { and, asc, desc, eq } from 'drizzle-orm'

import { campaignBudgetLines, campaigns, contentItems, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** Campaign detail: linked content, budget lines, and an auto summary (CC-10/11/12). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Campaign ID is required' })
    const db = useDrizzle()

    const [campaign] = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        objective: campaigns.objective,
        audience: campaigns.audience,
        startDate: campaigns.startDate,
        endDate: campaigns.endDate,
        budgetPlanned: campaigns.budgetPlanned,
        currency: campaigns.currency,
        status: campaigns.status,
        ownerUserId: campaigns.ownerUserId,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        reportSummary: campaigns.reportSummary,
        closedAt: campaigns.closedAt,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .leftJoin(users, eq(users.id, campaigns.ownerUserId))
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, ctx.organizationId)))
      .limit(1)
    if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Campaign not found' })

    const content = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        type: contentItems.type,
        status: contentItems.status,
        scheduledFor: contentItems.scheduledFor,
        publishedAt: contentItems.publishedAt,
        platform: contentItems.platform,
        publishedUrl: contentItems.publishedUrl,
        isPaid: contentItems.isPaid,
        spend: contentItems.spend,
        metrics: contentItems.metrics,
      })
      .from(contentItems)
      .where(
        and(eq(contentItems.campaignId, id), eq(contentItems.organizationId, ctx.organizationId))
      )
      .orderBy(desc(contentItems.createdAt))

    // C2 — performance roll-up across the campaign's published posts: total spend
    // (paid vs free), and every captured metric summed by its label.
    const published = content.filter((c) => c.status === 'published')
    const metricTotals: Record<string, number> = {}
    let totalSpend = 0
    let paidCount = 0
    for (const c of published) {
      totalSpend += Number(c.spend ?? 0)
      if (c.isPaid) paidCount++
      for (const [k, v] of Object.entries(c.metrics ?? {}))
        metricTotals[k] = (metricTotals[k] ?? 0) + Number(v)
    }
    const performance = {
      publishedCount: published.length,
      paidCount,
      freeCount: published.length - paidCount,
      totalSpend,
      metricTotals,
    }

    const budgetLines = await db
      .select()
      .from(campaignBudgetLines)
      .where(eq(campaignBudgetLines.campaignId, id))
      .orderBy(asc(campaignBudgetLines.createdAt))

    const plannedFromLines = budgetLines.reduce((s, l) => s + Number(l.plannedAmount), 0)
    const actual = budgetLines.reduce((s, l) => s + Number(l.actualAmount), 0)
    const budgetPlanned = plannedFromLines || Number(campaign.budgetPlanned ?? 0)
    const summary = {
      contentTotal: content.length,
      contentPublished: content.filter((c) => c.status === 'published').length,
      budgetPlanned,
      budgetActual: actual,
      budgetVariance: budgetPlanned - actual,
    }

    return { campaign, content, budgetLines, summary, performance }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading campaign', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
