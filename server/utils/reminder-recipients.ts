import { inArray } from 'drizzle-orm'

import { users } from '../database/schema'
import { useDrizzle } from './drizzle'

export interface ReminderRecipient {
  email: string
  firstName: string | null
}

/**
 * Fetch email + first name for a set of user ids in one query. Used by the
 * donor-grant and partnership-renewal reminders to notify the client's extra
 * recipient list alongside the owner.
 */
export async function fetchRecipientUsers(ids: string[]): Promise<Map<string, ReminderRecipient>> {
  const map = new Map<string, ReminderRecipient>()
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return map
  const rows = await useDrizzle()
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(inArray(users.id, unique))
  for (const r of rows) map.set(r.id, { email: r.email, firstName: r.firstName })
  return map
}

/**
 * Build the de-duplicated recipient list for a client reminder: the owner first
 * (when present), then each extra recipient — skipping duplicate emails.
 */
export function buildRecipientList(
  owner: ReminderRecipient | null,
  extraIds: string[] | null | undefined,
  userMap: Map<string, ReminderRecipient>
): ReminderRecipient[] {
  const out: ReminderRecipient[] = []
  const seen = new Set<string>()
  const push = (r: ReminderRecipient | null | undefined) => {
    if (!r?.email) return
    const key = r.email.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(r)
  }
  push(owner)
  for (const id of extraIds ?? []) push(userMap.get(id) ?? null)
  return out
}
