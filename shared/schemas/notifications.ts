// Notification categories group the many `type` strings into a handful of
// preference switches. In-app delivery is always on; email is per-category.
export const NOTIFICATION_CATEGORIES = [
  {
    key: 'assignments',
    label: 'Assignments & team',
    help: 'Being added to projects, proposals, reviews.',
  },
  {
    key: 'reviews',
    label: 'Reviews & approvals',
    help: 'Review requests and decisions on your work.',
  },
  {
    key: 'deadlines',
    label: 'Deadlines & reminders',
    help: 'Upcoming opportunity, proposal and grant dates.',
  },
  {
    key: 'finance',
    label: 'Finance & procurement',
    help: 'Expense decisions, budget alerts, PO updates.',
  },
  { key: 'system', label: 'System & account', help: 'Security, account and platform notices.' },
] as const
export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORIES)[number]['key']

/** Map a notification `type` to its preference category. */
export function categoryForType(type: string): NotificationCategoryKey {
  if (/assign|member|added|pm/i.test(type)) return 'assignments'
  if (/review|approv|decision|publish/i.test(type)) return 'reviews'
  if (/deadline|reminder|renewal|grant|due/i.test(type)) return 'deadlines'
  if (/expense|budget|invoice|purchase|po_|finance|procurement/i.test(type)) return 'finance'
  return 'system'
}

export const DIGEST_FREQUENCIES = ['off', 'daily', 'weekly'] as const
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number]
