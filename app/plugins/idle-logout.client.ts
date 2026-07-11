/**
 * Hard idle auto-logout. While signed in, a timer counts down the configured
 * idle window (runtimeConfig.public.idleTimeoutMinutes). Any real user activity
 * resets it; once the window elapses with no activity the user is signed out
 * and sent to /login with a "session expired" notice — so an abandoned tab
 * doesn't sit on a stale screen until the next click.
 *
 * A throttled heartbeat keeps the *server* session alive in step with on-screen
 * activity (the server only otherwise refreshes on API calls). The server-side
 * idle-timeout middleware remains the authoritative gate; this is UX polish.
 */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
const RESET_THROTTLE_MS = 5_000 // coalesce frequent events
const HEARTBEAT_THROTTLE_MS = 2 * 60_000 // ping the server at most this often
const WARN_BEFORE_MS = 60_000 // warn one minute before logout
const WARNING_TOAST_ID = 'idle-warning'

export default defineNuxtPlugin((nuxtApp) => {
  const { loggedIn } = useUserSession()
  const idleMs = (useRuntimeConfig().public.idleTimeoutMinutes as number) * 60_000

  let warnTimer: ReturnType<typeof setTimeout> | null = null
  let logoutTimer: ReturnType<typeof setTimeout> | null = null
  let lastReset = 0
  let lastBeat = 0
  let active = false
  let loggingOut = false

  const toast = () => useToast()

  function clearTimers() {
    if (warnTimer) clearTimeout(warnTimer)
    if (logoutTimer) clearTimeout(logoutTimer)
    warnTimer = logoutTimer = null
  }

  async function logout() {
    if (loggingOut) return
    loggingOut = true
    stop()
    await nuxtApp.runWithContext(async () => {
      const { clear } = useUserSession()
      const router = useRouter()
      const current = router.currentRoute.value
      await clear()
      await navigateTo({
        path: '/login',
        query: { redirect: current.fullPath, reason: 'session-expired' },
      })
    })
  }

  function schedule() {
    clearTimers()
    toast().remove(WARNING_TOAST_ID)
    warnTimer = setTimeout(
      () => {
        toast().add({
          id: WARNING_TOAST_ID,
          title: 'Still there?',
          description: 'You will be signed out in 1 minute due to inactivity.',
          color: 'warning',
          icon: 'i-lucide-clock',
        })
      },
      Math.max(0, idleMs - WARN_BEFORE_MS)
    )
    logoutTimer = setTimeout(logout, idleMs)
  }

  function onActivity() {
    const now = Date.now()
    // Keep the server session warm while the user is genuinely active.
    if (now - lastBeat > HEARTBEAT_THROTTLE_MS) {
      lastBeat = now
      // Cast $fetch to a plain function so TS doesn't resolve the path against
      // the (now very large) generated route union — avoids a deep
      // type-instantiation error.
      void (globalThis.$fetch as (url: string) => Promise<unknown>)('/api/auth/heartbeat').catch(
        () => {}
      )
    }
    if (now - lastReset < RESET_THROTTLE_MS) return
    lastReset = now
    schedule()
  }

  function start() {
    if (active) return
    active = true
    loggingOut = false
    lastReset = lastBeat = Date.now()
    for (const e of ACTIVITY_EVENTS) {
      window.addEventListener(e, onActivity, { passive: true })
    }
    schedule()
  }

  function stop() {
    if (!active) return
    active = false
    clearTimers()
    toast().remove(WARNING_TOAST_ID)
    for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity)
  }

  watch(loggedIn, (v) => (v ? start() : stop()), { immediate: true })
})
