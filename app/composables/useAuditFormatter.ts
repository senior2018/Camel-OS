import {
  OPPORTUNITY_SOURCE_LABEL,
  OPPORTUNITY_STAGE_LABEL,
  OPPORTUNITY_TYPE_LABEL,
  type OpportunitySource,
  type OpportunityStage,
  type OpportunityType,
} from '@@/shared/schemas/opportunity'

/**
 * Turns the raw `{ resource, action, meta }` of an audit-log row into a single
 * human sentence ("Moved 'Test Tender' from Discovery → Qualifying") plus an
 * optional set of `field: value` pairs for the expanded view.
 *
 * Add new branch here whenever a module starts logging a new audit action —
 * the viewer stays a single template, the formatter is the one place to update.
 */
export interface FormattedAudit {
  summary: string
  fields: Array<{ label: string; value: string }>
}

type Meta = Record<string, unknown>

function str(meta: Meta, key: string): string | null {
  const v = meta[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

function humanise(snake: string): string {
  return snake.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatOpportunity(action: string, meta: Meta): FormattedAudit {
  const title = str(meta, 'title')
  switch (action) {
    case 'create':
      return {
        summary: `Created opportunity${title ? ` "${title}"` : ''}`,
        fields: [
          { label: 'Source', value: opportunityLabel('source', str(meta, 'source')) },
          { label: 'Type', value: opportunityLabel('type', str(meta, 'type')) },
        ].filter((f) => f.value),
      }
    case 'update': {
      const fields = Array.isArray(meta.fields) ? (meta.fields as string[]) : []
      const labelled = fields.map(humanise).join(', ')
      return {
        summary: `Edited opportunity${title ? ` "${title}"` : ''}${
          labelled ? ` — ${labelled}` : ''
        }`,
        fields: [],
      }
    }
    case 'delete':
      return {
        summary: `Deleted opportunity${title ? ` "${title}"` : ''}`,
        fields: [],
      }
    case 'stage_changed': {
      const from = opportunityLabel('stage', str(meta, 'fromStage'))
      const to = opportunityLabel('stage', str(meta, 'toStage'))
      const note = str(meta, 'note')
      return {
        summary: `Moved${title ? ` "${title}"` : ''} from ${from} → ${to}`,
        fields: note ? [{ label: 'Note', value: note }] : [],
      }
    }
    case 'approved':
      return {
        summary: `Approved opportunity${title ? ` "${title}"` : ''} to pursue`,
        fields: [],
      }
    case 'approval_revoked':
      return {
        summary: `Revoked approval to pursue${title ? ` for "${title}"` : ''}`,
        fields: [],
      }
    case 'deadline_reminder_sent': {
      const recipient = str(meta, 'recipient')
      const daysUntil = typeof meta.daysUntil === 'number' ? meta.daysUntil : null
      const when =
        daysUntil === 0
          ? 'today'
          : daysUntil === 1
            ? 'tomorrow'
            : daysUntil !== null
              ? `in ${daysUntil} days`
              : 'soon'
      return {
        summary: `Deadline reminder sent${title ? ` for "${title}"` : ''} — due ${when}`,
        fields: recipient ? [{ label: 'To', value: recipient }] : [],
      }
    }
    case 'deadline_reminders_run': {
      const sent = typeof meta.sent === 'number' ? meta.sent : 0
      const scanned = typeof meta.scanned === 'number' ? meta.scanned : 0
      return {
        summary: `Ran deadline-reminder task — ${sent} sent / ${scanned} scanned`,
        fields: [],
      }
    }
    case 'attachment_uploaded': {
      const fileName = str(meta, 'fileName')
      return {
        summary: `Uploaded attachment${fileName ? ` "${fileName}"` : ''}`,
        fields: [],
      }
    }
    case 'attachment_deleted': {
      const fileName = str(meta, 'fileName')
      return {
        summary: `Deleted attachment${fileName ? ` "${fileName}"` : ''}`,
        fields: [],
      }
    }
    default:
      return { summary: `${humanise(action)} opportunity${title ? ` "${title}"` : ''}`, fields: [] }
  }
}

function opportunityLabel(kind: 'source' | 'type' | 'stage', raw: string | null): string {
  if (!raw) return ''
  if (kind === 'source') return OPPORTUNITY_SOURCE_LABEL[raw as OpportunitySource] ?? raw
  if (kind === 'type') return OPPORTUNITY_TYPE_LABEL[raw as OpportunityType] ?? raw
  return OPPORTUNITY_STAGE_LABEL[raw as OpportunityStage] ?? raw
}

function formatAuth(action: string, meta: Meta): FormattedAudit {
  const ip = str(meta, 'ip')
  const ipSuffix = ip ? ` (IP ${ip})` : ''

  switch (action) {
    case 'login':
      return { summary: `Signed in${ipSuffix}`, fields: [] }
    case 'login_failed':
      return {
        summary: `Failed sign-in attempt${ipSuffix}`,
        fields: [
          { label: 'Attempt #', value: String(meta.attempt ?? '') },
          { label: 'Locked', value: meta.locked ? 'Yes' : 'No' },
        ].filter((f) => f.value !== ''),
      }
    case 'login_blocked':
      return { summary: `Blocked sign-in attempt${ipSuffix}`, fields: [] }
    case 'account_locked':
      return {
        summary: `Account locked after ${meta.attempts ?? 'multiple'} failed attempts${ipSuffix}`,
        fields: [],
      }
    case 'password_changed':
      return { summary: `Changed password${ipSuffix}`, fields: [] }
    case 'password_reset':
      return { summary: `Reset password${ipSuffix}`, fields: [] }
    case 'password_expired':
      return { summary: `Password expired and a change was forced`, fields: [] }
    case 'mfa_challenge_issued':
      return { summary: `MFA challenge issued${ipSuffix}`, fields: [] }
    case 'mfa_challenge_passed':
      return {
        summary: `Passed MFA challenge via ${humanise(String(meta.method ?? 'totp'))}${ipSuffix}`,
        fields: [],
      }
    case 'mfa_challenge_failed':
      return {
        summary: `Failed MFA challenge — ${humanise(String(meta.reason ?? 'invalid_code'))}${ipSuffix}`,
        fields: [],
      }
    case 'email_verified':
      return { summary: `Verified their email address`, fields: [] }
    default:
      return { summary: humanise(action) + ipSuffix, fields: [] }
  }
}

function formatUser(action: string, meta: Meta): FormattedAudit {
  const target = str(meta, 'targetEmail')
  switch (action) {
    case 'deactivate':
      return { summary: `Deactivated user${target ? ` ${target}` : ''}`, fields: [] }
    case 'reactivate':
      return { summary: `Reactivated user${target ? ` ${target}` : ''}`, fields: [] }
    case 'roles_updated':
      return {
        summary: `Updated user roles${meta.roleCount ? ` (${meta.roleCount} now assigned)` : ''}`,
        fields: [],
      }
    default:
      return { summary: humanise(action) + (target ? ` ${target}` : ''), fields: [] }
  }
}

function formatInvitation(action: string, meta: Meta): FormattedAudit {
  const email = str(meta, 'email')
  switch (action) {
    case 'invite_sent':
      return { summary: `Sent invitation to ${email ?? 'a user'}`, fields: [] }
    case 'invite_resent':
      return { summary: `Resent invitation to ${email ?? 'a user'}`, fields: [] }
    case 'invite_revoked':
      return { summary: `Revoked invitation for ${email ?? 'a user'}`, fields: [] }
    case 'invite_accepted':
      return { summary: `Invitation accepted by ${email ?? 'a user'}`, fields: [] }
    default:
      return { summary: humanise(action), fields: [] }
  }
}

function formatRole(action: string, meta: Meta): FormattedAudit {
  const name = str(meta, 'name')
  switch (action) {
    case 'create':
      return { summary: `Created role${name ? ` "${name}"` : ''}`, fields: [] }
    case 'update':
      return {
        summary: `Updated role${name ? ` "${name}"` : ''}${meta.permissionCount ? ` (${meta.permissionCount} permissions)` : ''}`,
        fields: [],
      }
    case 'delete':
      return { summary: `Deleted role${name ? ` "${name}"` : ''}`, fields: [] }
    default:
      return { summary: humanise(action), fields: [] }
  }
}

function formatPasswordPolicy(action: string): FormattedAudit {
  if (action === 'update') return { summary: 'Updated password policy', fields: [] }
  return { summary: humanise(action), fields: [] }
}

function formatClient(action: string, meta: Meta): FormattedAudit {
  const name = str(meta, 'name')
  switch (action) {
    case 'create':
      return { summary: `Created client${name ? ` "${name}"` : ''}`, fields: [] }
    case 'update': {
      const fields = Array.isArray(meta.fields) ? (meta.fields as string[]) : []
      const labelled = fields.map(humanise).join(', ')
      return {
        summary: `Edited client${labelled ? ` — ${labelled}` : ''}`,
        fields: [],
      }
    }
    case 'delete':
      return { summary: `Deleted client${name ? ` "${name}"` : ''}`, fields: [] }
    case 'contact_added':
      return { summary: `Added contact${name ? ` "${name}"` : ''}`, fields: [] }
    case 'contact_updated':
      return { summary: 'Updated a contact', fields: [] }
    case 'contact_removed':
      return { summary: `Removed contact${name ? ` "${name}"` : ''}`, fields: [] }
    case 'interaction_logged':
      return {
        summary: `Logged a ${humanise(String(meta.type ?? 'note'))}`,
        fields: [],
      }
    case 'interaction_updated':
      return { summary: 'Updated an interaction', fields: [] }
    case 'interaction_removed':
      return { summary: 'Removed an interaction', fields: [] }
    case 'opportunity_linked': {
      const oppTitle = str(meta, 'opportunityTitle')
      const primary = meta.isPrimary === true ? ' (primary)' : ''
      return {
        summary: `Linked opportunity${oppTitle ? ` "${oppTitle}"` : ''}${primary}`,
        fields: [],
      }
    }
    case 'opportunity_unlinked':
      return { summary: 'Unlinked an opportunity', fields: [] }
    case 'reminder_created':
      return {
        summary: `Created reminder${meta.dueAt ? ` due ${meta.dueAt}` : ''}`,
        fields: [],
      }
    case 'reminder_updated':
      return { summary: 'Updated a reminder', fields: [] }
    case 'reminder_completed':
      return { summary: 'Marked a reminder complete', fields: [] }
    case 'reminder_removed':
      return { summary: 'Removed a reminder', fields: [] }
    case 'reminder_sent': {
      const recipient = str(meta, 'recipient')
      const clientName = str(meta, 'clientName')
      return {
        summary: `Sent reminder email${clientName ? ` for "${clientName}"` : ''}`,
        fields: recipient ? [{ label: 'To', value: recipient }] : [],
      }
    }
    case 'reminders_run': {
      const sent = typeof meta.sent === 'number' ? meta.sent : 0
      const scanned = typeof meta.scanned === 'number' ? meta.scanned : 0
      return {
        summary: `Ran client-reminder task — ${sent} sent / ${scanned} scanned`,
        fields: [],
      }
    }
    case 'grant_created':
      return {
        summary: `Added grant${str(meta, 'title') ? ` "${str(meta, 'title')}"` : ''}`,
        fields: [],
      }
    case 'grant_updated':
      return {
        summary: `Updated a grant${meta.status ? ` (${humanise(String(meta.status))})` : ''}`,
        fields: [],
      }
    case 'grant_removed':
      return {
        summary: `Removed grant${str(meta, 'title') ? ` "${str(meta, 'title')}"` : ''}`,
        fields: [],
      }
    case 'grant_deadline_sent': {
      const recipient = str(meta, 'recipient')
      const kind = str(meta, 'kind')
      const date = str(meta, 'deadlineDate')
      return {
        summary: `Sent grant ${kind === 'reporting' ? 'reporting' : 'end-date'} reminder — due ${date}`,
        fields: recipient ? [{ label: 'To', value: recipient }] : [],
      }
    }
    case 'grant_deadlines_run': {
      const sentEnd = typeof meta.sentEndDate === 'number' ? meta.sentEndDate : 0
      const sentRep = typeof meta.sentReporting === 'number' ? meta.sentReporting : 0
      const scanned = typeof meta.scanned === 'number' ? meta.scanned : 0
      return {
        summary: `Ran grant-deadline task — ${sentEnd + sentRep} sent / ${scanned} scanned`,
        fields: [],
      }
    }
    case 'contacts_imported': {
      const total = typeof meta.total === 'number' ? meta.total : 0
      const inserted = typeof meta.inserted === 'number' ? meta.inserted : 0
      const updated = typeof meta.updated === 'number' ? meta.updated : 0
      const skipped = typeof meta.skipped === 'number' ? meta.skipped : 0
      const errors = typeof meta.errors === 'number' ? meta.errors : 0
      return {
        summary: `Imported contacts (${total} rows) — ${inserted} added, ${updated} updated, ${skipped} skipped, ${errors} errors`,
        fields: [],
      }
    }
    case 'activity_report_exported': {
      const from = str(meta, 'from')
      const to = str(meta, 'to')
      return {
        summary: `Exported CRM activity report${from && to ? ` (${from} → ${to})` : ''}`,
        fields: [],
      }
    }
    default:
      return { summary: `${humanise(action)} client${name ? ` "${name}"` : ''}`, fields: [] }
  }
}

function formatAuditLog(action: string, meta: Meta): FormattedAudit {
  if (action === 'export') {
    return {
      summary: `Exported audit log${meta.rowCount ? ` (${meta.rowCount} rows)` : ''}`,
      fields: [],
    }
  }
  return { summary: humanise(action), fields: [] }
}

export function useAuditFormatter() {
  function format(resource: string, action: string, meta: unknown): FormattedAudit {
    const m = (meta && typeof meta === 'object' ? meta : {}) as Meta
    switch (resource) {
      case 'opportunity':
        return formatOpportunity(action, m)
      case 'client':
        return formatClient(action, m)
      case 'auth':
        return formatAuth(action, m)
      case 'user':
        return formatUser(action, m)
      case 'user_invitation':
        return formatInvitation(action, m)
      case 'role':
        return formatRole(action, m)
      case 'password_policy':
        return formatPasswordPolicy(action)
      case 'audit_log':
        return formatAuditLog(action, m)
      default:
        return { summary: `${humanise(action)} ${humanise(resource)}`, fields: [] }
    }
  }

  return { format }
}
