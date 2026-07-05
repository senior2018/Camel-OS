<script setup lang="ts">
/**
 * Sub-navigation for the Communications module. Calendar, Campaigns,
 * Stakeholders and Media live as TABS here (not separate sidebar items).
 * Insights Library stays in the sidebar — it's for all staff, not just the
 * comms team.
 */
const route = useRoute()
const { can } = await usePermissions()
// Settings is leader/admin-only, matching the page + API guard.
const canManageSettings = computed(
  () => can.value('communications', 'admin') || can.value('admin', 'admin')
)

interface Tab {
  label: string
  to: string
  icon: string
  active: () => boolean
}
const tabs = computed<Tab[]>(() => [
  {
    label: 'Content',
    to: '/communications',
    icon: 'i-lucide-megaphone',
    active: () => route.path === '/communications',
  },
  {
    label: 'Calendar',
    to: '/communications/calendar',
    icon: 'i-lucide-calendar-days',
    active: () => route.path === '/communications/calendar',
  },
  {
    label: 'Campaigns',
    to: '/campaigns',
    icon: 'i-lucide-rocket',
    active: () => route.path.startsWith('/campaigns'),
  },
  {
    label: 'Stakeholders',
    to: '/stakeholders',
    icon: 'i-lucide-network',
    active: () => route.path.startsWith('/stakeholders'),
  },
  {
    label: 'Media',
    to: '/media',
    icon: 'i-lucide-radio',
    active: () => route.path.startsWith('/media'),
  },
  ...(canManageSettings.value
    ? [
        {
          label: 'Settings',
          to: '/communications/settings',
          icon: 'i-lucide-settings',
          active: () => route.path === '/communications/settings',
        },
      ]
    : []),
])
</script>

<template>
  <div class="border-b border-default">
    <nav class="-mb-px flex gap-1 overflow-x-auto">
      <NuxtLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
        :class="
          t.active()
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-default'
        "
      >
        <UIcon :name="t.icon" class="size-4" />
        {{ t.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
