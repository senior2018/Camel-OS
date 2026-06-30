/**
 * Working-day count between two ISO dates (inclusive), excluding weekends.
 * Leave balances are reckoned in working days, so a Mon–Fri request is 5.
 */
export function countWorkingDays(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00Z`)
  const end = new Date(`${endISO}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getUTCDay()
    if (dow !== 0 && dow !== 6) days++
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}
