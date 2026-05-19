// Internal platform: only auth-related pages are public. The root (`/`)
// is handled below — it always redirects, never renders.
const PUBLIC_ROUTES = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-email-sent',
  '/mfa-challenge',
  '/accept-invite',
])

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch, ready } = useUserSession()

  if (!ready.value) {
    await fetch()
  }

  const isAuthenticated = loggedIn.value
  const isPublicRoute = PUBLIC_ROUTES.has(to.path)

  // Root always routes based on session — no landing page exists.
  if (to.path === '/') {
    return navigateTo(isAuthenticated ? '/dashboard' : '/login')
  }

  // Authenticated users shouldn't see the login page.
  if (isAuthenticated && to.path === '/login') {
    return navigateTo('/dashboard')
  }

  // Unauthenticated users get redirected to login (with a returnable path).
  if (!isAuthenticated && !isPublicRoute) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.path)}`)
  }

  // Authenticated users with outstanding compliance flags can only access the
  // page that lets them resolve it. Order matters: MFA setup first (a stronger
  // gate), then password change.
  const { user } = useUserSession()
  const sessionUser = user.value as { mustChangePassword?: boolean; mustSetupMfa?: boolean } | null

  if (isAuthenticated && sessionUser?.mustSetupMfa && to.path !== '/mfa-setup') {
    return navigateTo('/mfa-setup')
  }

  if (isAuthenticated && sessionUser?.mustChangePassword && to.path !== '/change-password') {
    return navigateTo('/change-password')
  }
})
