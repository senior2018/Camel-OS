<script lang="ts" setup>
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Docs',
    to: '/docs/getting-started',
    active: route.path.startsWith('/docs/getting-started'),
  },
  {
    label: 'Components',
    to: '/docs/components',
    active: route.path.startsWith('/docs/components'),
  },
  {
    label: 'Figma',
    to: 'https://go.nuxt.com/figma-ui',
    target: '_blank',
  },
  {
    label: 'Releases',
    to: 'https://github.com/nuxt/ui/releases',
    target: '_blank',
  },
])
</script>

<template>
  <div>
    <UHeader>
      <template #left>
        <NuxtLink to="/">
          <AppLogo class="w-auto h-6 shrink-0" />
        </NuxtLink>

        <TemplateMenu />
      </template>

      <UNavigationMenu :items="navItems" />

      <template #right>
        <div class="flex items-center gap-x-5">
          <UButton to="/login" label="Login" variant="soft" color="neutral" />
          <UButton to="/register" label="Register" />
        </div>
      </template>
    </UHeader>

    <slot />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">Built with Nuxt UI • © {{ new Date().getFullYear() }}</p>
      </template>

      <template #right>
        <UButton
          to="https://github.com/nuxt-ui-templates/starter"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </div>
</template>
