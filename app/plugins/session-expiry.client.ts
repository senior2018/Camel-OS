/**
 * Global 401 handler. When any `$fetch` / `useFetch` call returns 401 while the
 * client still believes it is signed in — i.e. the server session expired (the
 * 30-min idle timeout) or was revoked mid-session — clear the stale local
 * session and bounce to /login with a "session expired" notice, instead of
 * letting pages surface a confusing "You do not have permission" error.
 *
 * A failed login (or any 401 while already logged out) is left alone — the
 * login form handles those — by gating on `loggedIn.value`.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { loggedIn } = useUserSession()

  // One redirect at a time; reset once a fresh session is established.
  let handling = false
  watch(loggedIn, (v) => {
    if (v) handling = false
  })

  const baseFetch = globalThis.$fetch
  globalThis.$fetch = baseFetch.create({
    async onResponseError({ response }) {
      if (response?.status !== 401 || handling) return

      await nuxtApp.runWithContext(async () => {
        const { loggedIn: isIn, clear } = useUserSession()
        if (!isIn.value) return // not a mid-session expiry — let callers handle it

        const router = useRouter()
        const current = router.currentRoute.value
        if (current.path === '/login') return

        handling = true
        useToast().add({
          title: 'Session expired',
          description: 'You were signed out due to inactivity. Please sign in again.',
          color: 'warning',
          icon: 'i-lucide-clock',
        })
        await clear()
        await navigateTo({
          path: '/login',
          query: { redirect: current.fullPath, reason: 'session-expired' },
        })
      })
    },
  }) as typeof baseFetch
})
