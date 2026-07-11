/** Monday (ISO date) of the week containing the given ISO date. */
export function weekStartOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const dow = d.getUTCDay() // 0 Sun … 6 Sat
  const diff = (dow + 6) % 7 // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}
