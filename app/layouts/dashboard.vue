<script setup lang="ts">
const route = useRoute()
const { user, clear } = useUserSession()

const { data: perms, can } = await usePermissions()

// Modules registered here as they ship. Each entry declares its required permission
// so users only see what they can actually access. `Overview` is unconditional —
// every authenticated user can see their own dashboard.
// ── Temporary nav feature flags ──────────────────────────────────────────────
// Hide modules still under internal testing from the sidebar WITHOUT touching
// their code or routes. Set back to `true` to restore them in the UI.
// (UI-only: the pages/permissions are untouched and ship as soon as flipped.)
const SHOW_COMMUNICATIONS: boolean = true
const SHOW_PROJECTS: boolean = true

const navItems = computed(() => {
  const items: Array<{ label: string; to: string; icon: string; active: boolean }> = [
    {
      label: 'Overview',
      to: '/dashboard',
      icon: 'i-lucide-layout-dashboard',
      active: route.path === '/dashboard',
    },
  ]
  if (can.value('opportunity', 'read')) {
    items.push({
      label: 'Opportunities',
      to: '/opportunities',
      icon: 'i-lucide-target',
      active: route.path.startsWith('/opportunities'),
    })
  }
  if (can.value('proposal', 'read')) {
    items.push({
      label: 'Proposals',
      to: '/proposals',
      icon: 'i-lucide-file-text',
      active: route.path.startsWith('/proposals'),
    })
  }
  if (SHOW_PROJECTS && can.value('project', 'read')) {
    items.push({
      label: 'Projects',
      to: '/projects',
      icon: 'i-lucide-briefcase',
      active: route.path.startsWith('/projects'),
    })
  }
  if (
    SHOW_COMMUNICATIONS &&
    (can.value('communications', 'create') ||
      can.value('communications', 'update') ||
      can.value('communications', 'approve'))
  ) {
    items.push({
      label: 'Communications',
      to: '/communications',
      icon: 'i-lucide-megaphone',
      active: route.path === '/communications' || /^\/communications\/[^/]+$/.test(route.path),
    })
    items.push({
      label: 'Content Calendar',
      to: '/communications/calendar',
      icon: 'i-lucide-calendar-days',
      active: route.path === '/communications/calendar',
    })
    items.push({
      label: 'Campaigns',
      to: '/campaigns',
      icon: 'i-lucide-rocket',
      active: route.path.startsWith('/campaigns'),
    })
    items.push({
      label: 'Stakeholders',
      to: '/stakeholders',
      icon: 'i-lucide-network',
      active: route.path.startsWith('/stakeholders'),
    })
    items.push({
      label: 'Media Monitoring',
      to: '/media',
      icon: 'i-lucide-radio',
      active: route.path.startsWith('/media'),
    })
  }
  if (SHOW_COMMUNICATIONS && can.value('communications', 'read')) {
    items.push({
      label: 'Insights Library',
      to: '/library',
      icon: 'i-lucide-library',
      active: route.path.startsWith('/library'),
    })
  }
  if (can.value('crm', 'read')) {
    // Customer Management covers clients, prospects, donors, and partners —
    // the page itself has tab filters per type and surfaces the two reports
    // (donor & partner dashboard, activity report) in its header.
    items.push({
      label: 'Customer Management',
      to: '/clients',
      icon: 'i-lucide-users',
      active:
        route.path.startsWith('/clients') ||
        route.path.startsWith('/reports/donor-partner') ||
        route.path === '/reports/crm-activity',
    })
  }
  return items
})

const adminItems = computed(() => {
  // Admin section shows when the user qualifies as admin by any route — legacy
  // flags or the new RBAC `admin:read` permission.
  if (!perms.value?.isAdmin && !can.value('admin', 'read')) return []
  return [
    {
      label: 'Users',
      to: '/admin/users',
      icon: 'i-lucide-users',
      active: route.path.startsWith('/admin/users'),
    },
    {
      label: 'Roles',
      to: '/admin/roles',
      icon: 'i-lucide-shield-check',
      active: route.path.startsWith('/admin/roles'),
    },
    {
      label: 'Security',
      to: '/admin/security',
      icon: 'i-lucide-lock',
      active: route.path.startsWith('/admin/security'),
    },
    {
      label: 'Audit log',
      to: '/admin/audit-log',
      icon: 'i-lucide-scroll-text',
      active: route.path.startsWith('/admin/audit-log'),
    },
    {
      label: 'Lookup values',
      to: '/admin/lookup-values',
      icon: 'i-lucide-list-tree',
      active: route.path.startsWith('/admin/lookup-values'),
    },
    {
      label: 'Proposal settings',
      to: '/admin/proposal-settings',
      icon: 'i-lucide-sliders-horizontal',
      active: route.path.startsWith('/admin/proposal-settings'),
    },
  ]
})

const settingsItems = [{ label: 'My profile', to: '/settings/profile', icon: 'i-lucide-user' }]

const userInitials = computed(() => {
  if (!user.value) return '?'
  const first = (user.value as { firstName?: string }).firstName ?? ''
  const last = (user.value as { lastName?: string }).lastName ?? ''
  return (
    (first.charAt(0) + last.charAt(0)).toUpperCase() ||
    (user.value as { email?: string }).email?.charAt(0).toUpperCase() ||
    '?'
  )
})

const fullName = computed(() => {
  if (!user.value) return ''
  const u = user.value as { firstName?: string; lastName?: string; email?: string }
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || ''
})

const mobileNavOpen = ref(false)

async function logout() {
  await clear()
  await navigateTo('/login')
}

const userMenu = [
  [{ label: 'Account settings', icon: 'i-lucide-user', to: '/dashboard#security' }],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: logout, color: 'error' as const }],
]
</script>

<template>
  <div class="flex min-h-screen bg-elevated/30">
    <!-- Sidebar (desktop) -->
    <aside
      class="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-default bg-default lg:flex"
    >
      <div class="flex h-16 items-center border-b border-default px-6">
        <NuxtLink to="/dashboard" aria-label="Camel OS home">
          <AppLogo />
        </NuxtLink>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-6">
        <p class="px-3 text-xs font-semibold uppercase tracking-wider text-muted">Workspace</p>
        <ul class="mt-3 space-y-1">
          <li v-for="item in navItems" :key="item.label">
            <ULink
              :to="item.to"
              :class="[
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                item.active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-default hover:bg-elevated/60',
              ]"
            >
              <UIcon :name="item.icon" class="size-4 shrink-0" />
              <span>{{ item.label }}</span>
            </ULink>
          </li>
        </ul>

        <template v-if="adminItems.length">
          <p class="mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Administration
          </p>
          <ul class="mt-3 space-y-1">
            <li v-for="item in adminItems" :key="item.label">
              <ULink
                :to="item.to"
                :class="[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  item.active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-default hover:bg-elevated/60',
                ]"
              >
                <UIcon :name="item.icon" class="size-4 shrink-0" />
                <span>{{ item.label }}</span>
              </ULink>
            </li>
          </ul>
        </template>

        <p class="mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-muted">Settings</p>
        <ul class="mt-3 space-y-1">
          <li v-for="item in settingsItems" :key="item.label">
            <ULink
              :to="item.to"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-default transition-colors hover:bg-elevated/60"
            >
              <UIcon :name="item.icon" class="size-4 shrink-0" />
              <span>{{ item.label }}</span>
            </ULink>
          </li>
        </ul>
      </nav>

      <!-- User card -->
      <div class="border-t border-default p-3">
        <UDropdownMenu :items="userMenu" :ui="{ content: 'w-56' }">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-elevated/60"
          >
            <div
              class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            >
              {{ userInitials }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-default">{{ fullName }}</p>
              <p class="truncate text-xs text-muted">{{ user?.email }}</p>
            </div>
            <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-muted" />
          </button>
        </UDropdownMenu>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex flex-1 flex-col lg:pl-64">
      <!-- Topbar -->
      <header
        class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-default bg-default/80 px-4 backdrop-blur sm:px-6 lg:px-8"
      >
        <!-- Mobile: logo + menu -->
        <div class="flex items-center gap-3 lg:hidden">
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-lucide-menu"
            aria-label="Open menu"
            @click="mobileNavOpen = true"
          />
          <NuxtLink to="/dashboard"><AppLogo variant="mark" /></NuxtLink>
        </div>

        <div class="hidden flex-1 lg:block">
          <h1 class="text-lg font-semibold text-default">Dashboard</h1>
        </div>

        <div class="flex items-center gap-1.5">
          <AppNotificationBell />
          <UDropdownMenu :items="userMenu">
            <button
              type="button"
              class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary lg:hidden"
              aria-label="Account menu"
            >
              {{ userInitials }}
            </button>
          </UDropdownMenu>
        </div>
      </header>

      <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <slot />
      </main>
    </div>

    <!-- Mobile nav drawer -->
    <USlideover v-model:open="mobileNavOpen" side="left" :ui="{ content: 'max-w-xs' }">
      <template #body>
        <div class="flex h-full flex-col">
          <div class="flex h-16 items-center border-b border-default px-6">
            <AppLogo />
          </div>
          <nav class="flex-1 overflow-y-auto px-3 py-6">
            <ul class="space-y-1">
              <li v-for="item in navItems" :key="item.label">
                <ULink
                  :to="item.to"
                  :class="[
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                    item.active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-default hover:bg-elevated/60',
                  ]"
                  @click="mobileNavOpen = false"
                >
                  <UIcon :name="item.icon" class="size-4" />
                  {{ item.label }}
                </ULink>
              </li>
              <li v-for="item in adminItems" :key="item.label">
                <ULink
                  :to="item.to"
                  :class="[
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                    item.active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-default hover:bg-elevated/60',
                  ]"
                  @click="mobileNavOpen = false"
                >
                  <UIcon :name="item.icon" class="size-4" />
                  {{ item.label }}
                </ULink>
              </li>
              <li v-for="item in settingsItems" :key="item.label">
                <ULink
                  :to="item.to"
                  class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-default hover:bg-elevated/60"
                  @click="mobileNavOpen = false"
                >
                  <UIcon :name="item.icon" class="size-4" />
                  {{ item.label }}
                </ULink>
              </li>
            </ul>
          </nav>
        </div>
      </template>
    </USlideover>
  </div>
</template>
