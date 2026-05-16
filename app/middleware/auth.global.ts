const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-email-sent',
  '/mfa-challenge',
])

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch, ready } = useUserSession()

  if (!ready.value) {
    await fetch()
  }

  const isAuthenticated = loggedIn.value
  const isPublicRoute = PUBLIC_ROUTES.has(to.path)

  // Redirect authenticated users away from public/auth pages
  if (isAuthenticated && (to.path === '/' || to.path === '/login' || to.path === '/register')) {
    return navigateTo('/dashboard')
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isAuthenticated && !isPublicRoute) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.path)}`)
  }
})
