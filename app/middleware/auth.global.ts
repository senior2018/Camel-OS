export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch, ready } = useUserSession()

  if (!ready.value) {
    await fetch()
  }

  const isAuthenticated = loggedIn.value
  const isPublicAuthRoute = to.path === '/login' || to.path === '/register'

  if (isAuthenticated && (isPublicAuthRoute || to.path === '/')) {
    return navigateTo('/dashboard')
  }
})
