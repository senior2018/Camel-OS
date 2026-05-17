<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const navItems: NavigationMenuItem[] = [
  { label: 'Platform', to: '/#platform' },
  { label: 'Solutions', to: '/#solutions' },
  { label: 'Impact', to: '/#impact' },
  { label: 'Pricing', to: '/#pricing' },
]

const { loggedIn } = useUserSession()
</script>

<template>
  <div class="min-h-screen bg-default">
    <UHeader :ui="{ container: 'max-w-7xl' }">
      <template #left>
        <NuxtLink to="/" aria-label="Camel OS home">
          <AppLogo />
        </NuxtLink>
      </template>

      <UNavigationMenu :items="navItems" highlight />

      <template #right>
        <div class="flex items-center gap-2">
          <UButton
            v-if="loggedIn"
            to="/dashboard"
            label="Go to dashboard"
            trailing-icon="i-lucide-arrow-right"
          />
          <template v-else>
            <UButton to="/login" label="Sign in" variant="ghost" color="neutral" />
            <UButton to="/register" label="Get started" trailing-icon="i-lucide-arrow-right" />
          </template>
        </div>
      </template>
    </UHeader>

    <slot />

    <footer class="border-t border-default bg-elevated/30">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div class="col-span-2 md:col-span-1">
            <AppLogo />
            <p class="mt-4 text-sm text-muted">
              The operating platform for modern consulting firms — engagements, grants, and impact,
              in one place.
            </p>
          </div>

          <div>
            <h3 class="text-sm font-semibold text-default">Platform</h3>
            <ul class="mt-4 space-y-2 text-sm">
              <li><ULink to="/#platform" class="text-muted hover:text-primary">Features</ULink></li>
              <li>
                <ULink to="/#solutions" class="text-muted hover:text-primary">Solutions</ULink>
              </li>
              <li><ULink to="/#pricing" class="text-muted hover:text-primary">Pricing</ULink></li>
              <li><ULink to="/login" class="text-muted hover:text-primary">Sign in</ULink></li>
            </ul>
          </div>

          <div>
            <h3 class="text-sm font-semibold text-default">Company</h3>
            <ul class="mt-4 space-y-2 text-sm">
              <li>
                <ULink
                  to="https://consult.saharaventures.com"
                  target="_blank"
                  class="text-muted hover:text-primary"
                  >About Sahara</ULink
                >
              </li>
              <li>
                <ULink
                  to="https://consult.saharaventures.com/impact"
                  target="_blank"
                  class="text-muted hover:text-primary"
                  >Our impact</ULink
                >
              </li>
              <li>
                <ULink
                  to="https://consult.saharaventures.com/contacts"
                  target="_blank"
                  class="text-muted hover:text-primary"
                  >Contact</ULink
                >
              </li>
            </ul>
          </div>

          <div>
            <h3 class="text-sm font-semibold text-default">Legal</h3>
            <ul class="mt-4 space-y-2 text-sm">
              <li><ULink to="#" class="text-muted hover:text-primary">Privacy</ULink></li>
              <li><ULink to="#" class="text-muted hover:text-primary">Terms</ULink></li>
              <li><ULink to="#" class="text-muted hover:text-primary">Security</ULink></li>
            </ul>
          </div>
        </div>

        <div
          class="mt-12 flex flex-col items-start justify-between gap-4 border-t border-default pt-8 sm:flex-row sm:items-center"
        >
          <p class="text-xs text-muted">
            © {{ new Date().getFullYear() }} Camel OS. All rights reserved.
          </p>
          <p class="text-xs text-muted">Built for impact-driven consulting firms.</p>
        </div>
      </div>
    </footer>
  </div>
</template>
