import { sql } from 'drizzle-orm'
import { useDrizzle } from '@@/server/utils/drizzle'

/** S27 — lightweight health probe for monitoring (no auth). */
export default defineEventHandler(async (event) => {
  const started = Date.now()
  let db = false
  try {
    await useDrizzle().execute(sql`select 1`)
    db = true
  } catch {
    db = false
  }
  setResponseStatus(event, db ? 200 : 503)
  return {
    status: db ? 'ok' : 'degraded',
    db,
    uptimeMs: Math.round(process.uptime() * 1000),
    latencyMs: Date.now() - started,
    time: new Date().toISOString(),
  }
})
