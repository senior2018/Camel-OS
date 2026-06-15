import { consola } from 'consola'

import { logAuditEvent } from '@@/server/utils/audit'
import { requirePermission } from '@@/server/utils/permission-guard'
import { buildWinLossReport, type WinLossRow } from '@@/server/utils/win-loss'

/**
 * BD-03 — CSV export of the win/loss report. One file with four sections
 * (overall + by sector / client / team) separated by blank lines for easy
 * opening in Excel / Google Sheets.
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
function pct(r: number | null): string {
  return r === null ? '' : `${r}%`
}

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const q = getQuery(event)
    const from = typeof q.from === 'string' && q.from ? q.from : null
    const to = typeof q.to === 'string' && q.to ? q.to : null

    const report = await buildWinLossReport(ctx.organizationId, { from, to })

    const section = (title: string, rows: WinLossRow[]): string[] => {
      const out = ['', row([title, 'Won', 'Lost', 'Win rate'])]
      if (!rows.length) out.push(row(['(none)', 0, 0, '']))
      for (const r of rows) out.push(row([r.key, r.won, r.lost, pct(r.winRate)]))
      return out
    }

    const lines: string[] = []
    lines.push('Win / Loss Report')
    lines.push(row(['From', from ?? 'all time', 'To', to ?? 'all time']))
    lines.push('')
    lines.push(row(['Overall', 'Won', 'Lost', 'Win rate', 'Decided']))
    lines.push(
      row([
        '',
        report.overall.won,
        report.overall.lost,
        pct(report.overall.winRate),
        report.overall.total,
      ])
    )
    lines.push(...section('By sector', report.bySector))
    lines.push(...section('By client', report.byClient))
    lines.push(...section('By team (Lead)', report.byTeam))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'win_loss_report_exported',
      resourceId: null,
      meta: { from, to },
    })

    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setResponseHeader(
      event,
      'Content-Disposition',
      `attachment; filename="win-loss-${from ?? 'all'}_${to ?? 'all'}.csv"`
    )
    return lines.join('\n')
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error exporting win/loss CSV', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
