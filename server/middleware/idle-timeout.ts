/**
 * Enforces the idle session timeout required by the auth NFR. The window is
 * configurable via `IDLE_TIMEOUT_MINUTES` (runtimeConfig.public, default 30)
 * so the server and the client auto-logout timer stay in lockstep.
 *
 * Runs on every Nitro request that has a session cookie:
 *  - If `lastActivityAt` is older than the idle window, the session is cleared.
 *    API callers get a 401 with a recognisable message; page requests continue
 *    to render and the global `auth` route middleware redirects to /login on
 *    the next navigation.
 *  - Otherwise, `lastActivityAt` is refreshed — but only if more than
 *    `BUMP_THRESHOLD_MS` has elapsed since the previous bump, so we don't
 *    rewrite the session cookie on every single asset/API request.
 *
 * The auth-utils endpoints (`/api/_auth/*`) are deliberately skipped so the
 * client's session-refresh calls don't reset the very timer we're enforcing.
 */
const BUMP_THRESHOLD_MS = 60 * 1000 // 1 minute

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (path.startsWith('/api/_auth/')) return

  const session = await getUserSession(event)
  if (!session.user) return

  const idleTimeoutMs = (useRuntimeConfig(event).public.idleTimeoutMinutes as number) * 60 * 1000

  const sessionUser = session.user as { lastActivityAt?: number }
  const lastActivity = sessionUser.lastActivityAt
  const now = Date.now()

  // Expired? Clear and (for API requests) reject so the client can react.
  if (lastActivity && now - lastActivity > idleTimeoutMs) {
    await clearUserSession(event)
    if (path.startsWith('/api/')) {
      setResponseHeader(event, 'X-Session-Expired', 'idle')
      throw createError({
        statusCode: 401,
        statusMessage: 'Your session expired due to inactivity. Please sign in again.',
      })
    }
    return
  }

  // Sliding bump — only when enough time has passed to keep cookie churn down.
  if (!lastActivity || now - lastActivity > BUMP_THRESHOLD_MS) {
    await setUserSession(event, {
      user: { ...session.user, lastActivityAt: now },
    })
  }
})
