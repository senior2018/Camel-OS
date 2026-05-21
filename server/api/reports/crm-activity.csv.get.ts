import { consola } from 'consola'
import { z } from 'zod'

import { requirePermission } from '@@/server/utils/permission-guard'
import { buildCrmActivityReport } from '@@/server/utils/crm-activity'
import { logAuditEvent } from '@@/server/utils/audit'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid from date'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid to date'),
  userId: z.string().uuid().optional(),
})

/**
 * CR-06 — CSV export of the CRM activity report. Returns a single file with
 * three sections separated by blank lines: headline totals, per-interaction-type
 * breakdown, per-user breakdown. The format trades pretty-printing for ease
 * of opening in Excel / Google Sheets.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function row(values: unknown[]): string {
  return values.map(csvEscape).join(',')
}

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'read')
    const parsed = querySchema.safeParse(getQuery(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid query',
      })
    }

    const report = await buildCrmActivityReport(ctx.organizationId, parsed.data)

    const lines: string[] = []
    lines.push('CRM Activity Report')
    lines.push(row(['From', report.filters.from, 'To', report.filters.to]))
    if (report.filters.userId) lines.push(row(['Filtered by user id', report.filters.userId]))
    lines.push('')
    lines.push(row(['Headline metric', 'Value']))
    lines.push(row(['Contacts reached', report.totals.contactsReached]))
    lines.push(row(['Interactions logged', report.totals.interactionsLogged]))
    lines.push(row(['Meetings held', report.totals.meetingsHeld]))
    for (const [currency, total] of Object.entries(report.pipelineValueByCurrency)) {
      lines.push(row([`Pipeline value (${currency})`, total]))
    }
    lines.push('')
    lines.push(row(['Interaction type', 'Count']))
    for (const r of report.byInteractionType) lines.push(row([r.type, r.count]))
    if (report.byUser.length) {
      lines.push('')
      lines.push(row(['Staff member', 'Interactions logged', 'Meetings held']))
      for (const r of report.byUser) {
        lines.push(row([r.userName, r.interactionsLogged, r.meetingsHeld]))
      }
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'activity_report_exported',
      resourceId: null,
      meta: { from: report.filters.from, to: report.filters.to, userId: report.filters.userId },
    })

    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setResponseHeader(
      event,
      'Content-Disposition',
      `attachment; filename="crm-activity-${report.filters.from}_${report.filters.to}.csv"`
    )
    return lines.join('\n')
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error exporting CRM activity CSV', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
