/**
 * Keep-alive ping. The client idle-logout timer calls this (throttled) while
 * the user is genuinely active in the tab. Because the request flows through
 * the idle-timeout middleware — which bumps `lastActivityAt` — it keeps the
 * server session in step with on-screen activity, even when the user isn't
 * triggering any other API calls. Returns 401 (via the guard) once expired.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return { ok: true }
})
