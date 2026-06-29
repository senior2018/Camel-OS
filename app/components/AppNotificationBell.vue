<script setup lang="ts">
interface Notif {
  id: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}

const { data, refresh } = await useFetch<{ items: Notif[]; unreadCount: number }>(
  '/api/notifications',
  { key: 'notifications', default: () => ({ items: [], unreadCount: 0 }) }
)
const open = ref(false)
const unread = computed(() => data.value?.unreadCount ?? 0)

watch(open, (v) => v && refresh())

async function markAll() {
  await $fetch('/api/notifications/read-all', { method: 'POST' })
  await refresh()
}
async function go(n: Notif) {
  if (!n.readAt) await $fetch(`/api/notifications/${n.id}/read`, { method: 'POST' })
  open.value = false
  await refresh()
  if (n.linkUrl) navigateTo(n.linkUrl)
}
function when(iso: string) {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

onMounted(() => {
  const t = setInterval(refresh, 60_000)
  onBeforeUnmount(() => clearInterval(t))
})
</script>

<template>
  <UPopover v-model:open="open">
    <UChip :show="unread > 0" :text="unread" size="2xl" color="error">
      <UButton
        icon="i-lucide-bell"
        variant="ghost"
        color="neutral"
        square
        aria-label="Notifications"
      />
    </UChip>

    <template #content>
      <div class="w-80 max-w-[90vw]">
        <div class="flex items-center justify-between border-b border-default px-3 py-2">
          <span class="text-sm font-semibold text-default">Notifications</span>
          <UButton
            v-if="unread > 0"
            variant="link"
            size="xs"
            color="neutral"
            label="Mark all read"
            @click="markAll"
          />
        </div>
        <ul v-if="data?.items.length" class="max-h-96 divide-y divide-default overflow-auto">
          <li
            v-for="n in data.items"
            :key="n.id"
            class="cursor-pointer px-3 py-2.5 transition-colors hover:bg-elevated/40"
            :class="n.readAt ? '' : 'bg-primary/5'"
            @click="go(n)"
          >
            <div class="flex items-start gap-2">
              <span
                class="mt-1.5 size-1.5 shrink-0 rounded-full"
                :class="n.readAt ? 'bg-transparent' : 'bg-primary'"
              />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">{{ n.title }}</p>
                <p v-if="n.body" class="truncate text-xs text-muted">{{ n.body }}</p>
                <p class="mt-0.5 text-xs text-dimmed">{{ when(n.createdAt) }}</p>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="px-3 py-8 text-center text-sm text-muted">You're all caught up.</p>
      </div>
    </template>
  </UPopover>
</template>
