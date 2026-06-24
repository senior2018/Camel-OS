import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import {
  opportunities,
  projects,
  proposalDocumentVersions,
  proposals,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { postProposalSystemMessage } from '@@/server/utils/proposal-conversation'
import { userHasPermission } from '@@/server/utils/role'
import { PROPOSAL_STATUS_LABEL, updateProposalSchema } from '@@/shared/schemas/proposal'

// Decided outcomes — changing one of these is an override, not a normal step.
const DECIDED_STATUSES = ['won', 'lost', 'contract_signed']

/**
 * S7 — Update a proposal. Status transitions stamp `submittedAt` / `decidedAt`
 * so the timeline shows when each milestone landed without us asking the user
 * to enter the date twice.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal id is required' })

    const parsed = updateProposalSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid proposal payload',
      })
    }

    const db = useDrizzle()
    const [existing] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const data = parsed.data

    // P3.3c — overriding a decided outcome (won/lost/contract_signed) is a
    // privileged correction: only a manager (proposal:admin) or system admin.
    if (
      data.status !== undefined &&
      data.status !== existing.status &&
      DECIDED_STATUSES.includes(existing.status)
    ) {
      const canOverride =
        ctx.isSystemAdmin || (await userHasPermission(ctx.userId, 'proposal', 'admin'))
      if (!canOverride) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Only a manager can override a decided outcome.',
        })
      }
    }

    // P3.3b — a Lost outcome must carry a reason.
    if (
      data.status === 'lost' &&
      !data.note?.trim() &&
      !data.decisionNote?.trim() &&
      !existing.decisionNote
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A reason is required when marking a proposal Lost.',
      })
    }

    const now = new Date()
    const updates: Partial<typeof proposals.$inferInsert> = { updatedAt: now }

    if (data.title !== undefined) updates.title = data.title
    if (data.deadline !== undefined) updates.deadline = data.deadline ?? null
    if (data.contentDraft !== undefined) updates.contentDraft = data.contentDraft ?? null
    if (data.decisionNote !== undefined) updates.decisionNote = data.decisionNote ?? null
    if (data.reminderRecipientUserIds !== undefined) {
      updates.reminderRecipientUserIds = data.reminderRecipientUserIds
    }
    if (data.writingMode !== undefined) updates.writingMode = data.writingMode
    if (data.brainstorm !== undefined) updates.brainstorm = data.brainstorm ?? null
    if (data.submissionReference !== undefined) {
      updates.submissionReference = data.submissionReference ?? null
    }
    if (data.submissionChannel !== undefined) {
      updates.submissionChannel = data.submissionChannel ?? null
    }
    if (data.evaluationStage !== undefined) updates.evaluationStage = data.evaluationStage ?? null
    if (data.status !== undefined && data.status !== existing.status) {
      updates.status = data.status
      // Stamp milestone timestamps so the timeline is self-explanatory.
      if (data.status === 'submitted' && !existing.submittedAt) updates.submittedAt = now
      const isDecision =
        data.status === 'won' ||
        data.status === 'lost' ||
        data.status === 'shortlisted' ||
        data.status === 'contract_signed'
      if (isDecision && !existing.decidedAt) updates.decidedAt = now
      // Leaving the evaluation phase clears the working stage label.
      if (isDecision || data.status === 'final_rejected') updates.evaluationStage = null
      // A win/loss note is kept as the decision note.
      if ((data.status === 'won' || data.status === 'lost') && data.note?.trim()) {
        updates.decisionNote = data.note.trim()
      }
    }

    // BD-04 — transitioning into 'contract_signed' auto-creates a project,
    // inheriting value/currency from the opportunity. Guarded so it fires once.
    const enteringContract =
      data.status === 'contract_signed' && existing.status !== 'contract_signed'

    // PM-03 — snapshot the document for version history, throttled to one per
    // ~2-minute editing burst so autosave doesn't flood the history.
    if (
      data.contentDraft !== undefined &&
      (data.contentDraft ?? '') !== (existing.contentDraft ?? '')
    ) {
      const [last] = await db
        .select({ createdAt: proposalDocumentVersions.createdAt })
        .from(proposalDocumentVersions)
        .where(eq(proposalDocumentVersions.proposalId, id))
        .orderBy(desc(proposalDocumentVersions.createdAt))
        .limit(1)
      const stale = !last || Date.now() - new Date(last.createdAt).getTime() > 2 * 60 * 1000
      if (stale) {
        await db.insert(proposalDocumentVersions).values({
          proposalId: id,
          organizationId: ctx.organizationId,
          content: data.contentDraft ?? null,
          savedByUserId: ctx.userId,
        })
      }
    }

    const [updated] = await db
      .update(proposals)
      .set(updates)
      .where(eq(proposals.id, id))
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: data.status && data.status !== existing.status ? 'status_change' : 'update',
      resourceId: id,
      meta: {
        from: existing.status,
        to: updated?.status,
        fields: Object.keys(updates).filter((k) => k !== 'updatedAt'),
      },
    })

    if (data.status !== undefined && data.status !== existing.status) {
      await logOpportunityActivity({
        opportunityId: existing.opportunityId,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'proposal:status',
        details: { from: existing.status, to: data.status },
      })
      // Surface the milestone in the conversation (best-effort). Include the
      // evaluation-stage label and/or the note when provided.
      const label =
        data.status === 'under_evaluation' && data.evaluationStage
          ? data.evaluationStage
          : PROPOSAL_STATUS_LABEL[data.status]
      await postProposalSystemMessage({
        proposalId: id,
        organizationId: ctx.organizationId,
        body: `Status changed to ${label}${data.note?.trim() ? `: "${data.note.trim()}"` : ''}`,
        eventType: 'status_change',
        actorUserId: ctx.userId,
      }).catch(() => {})
    }

    let createdProjectId: string | null = null
    if (enteringContract) {
      const [opp] = await db
        .select({ value: opportunities.estimatedValue, currency: opportunities.currency })
        .from(opportunities)
        .where(eq(opportunities.id, existing.opportunityId))
        .limit(1)
      const [project] = await db
        .insert(projects)
        .values({
          organizationId: ctx.organizationId,
          name: existing.title,
          description: `Created from won proposal "${existing.title}".`,
          status: 'planning',
          totalBudget: opp?.value ?? null,
          currency: opp?.currency ?? 'USD',
          createdByUserId: ctx.userId,
        })
        .returning({ id: projects.id })
      createdProjectId = project?.id ?? null
      await logOpportunityActivity({
        opportunityId: existing.opportunityId,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'proposal:project_created',
        details: { projectId: createdProjectId },
      })
    }

    return { success: true, proposal: updated, projectId: createdProjectId }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating proposal', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
