<script setup lang="ts">
import {
  NOTIFICATION_CATEGORIES,
  categoryForType,
  DIGEST_FREQUENCIES,
  type DigestFrequency,
} from '@@/shared/schemas/notifications'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Notifications — Camel OS' })
const toast = useToast()

const tab = ref<'inbox' | 'preferences'>('inbox')

interface Note {
  id: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}
const { data, refresh } = await useFetch<{ items: Note[]; unreadCount: number }>(
  '/api/notifications',
  {
    key: 'notif-center',
    default: () => ({ items: [], unreadCount: 0 }),
  }
)
const filter = ref<'all' | 'unread'>('all')
const shown = computed(() =>
  filter.value === 'unread'
    ? (data.value?.items ?? []).filter((n) => !n.readAt)
    : (data.value?.items ?? [])
)

async function open(n: Note) {
  if (!n.readAt) await $fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {})
  await refresh()
  if (n.linkUrl) navigateTo(n.linkUrl)
}
async function markAll() {
  await $fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
  await refresh()
}

// Preferences
const { data: prefs, refresh: refreshPrefs } = await useFetch<{
  emailByCategory: Record<string, boolean>
  digestFrequency: DigestFrequency
}>('/api/notifications/preferences', {
  key: 'notif-prefs',
  default: () => ({ emailByCategory: {}, digestFrequency: 'off' as DigestFrequency }),
})
const emailByCategory = reactive<Record<string, boolean>>({})
const digest = ref<DigestFrequency>('off')
watchEffect(() => {
  for (const c of NOTIFICATION_CATEGORIES)
    emailByCategory[c.key] = prefs.value?.emailByCategory[c.key] ?? false
  digest.value = prefs.value?.digestFrequency ?? 'off'
})
const savingPrefs = ref(false)
async function savePrefs() {
  savingPrefs.value = true
  try {
    await $fetch('/api/notifications/preferences', {
      method: 'PUT',
      body: { emailByCategory: { ...emailByCategory }, digestFrequency: digest.value },
    })
    toast.add({ title: 'Preferences saved', color: 'success' })
    await refreshPrefs()
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    savingPrefs.value = false
  }
}
const catLabel = (t: string) =>
  NOTIFICATION_CATEGORIES.find((c) => c.key === categoryForType(t))?.label ?? 'System'
const when = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
const digestItems = DIGEST_FREQUENCIES.map((f) => ({
  label: f === 'off' ? 'No digest' : `${f[0]!.toUpperCase()}${f.slice(1)} digest`,
  value: f,
}))
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Notifications</h1>
        <p class="mt-1 text-sm text-muted">Your activity feed and how you'd like to be reached.</p>
      </div>
      <UButton
        v-if="tab === 'inbox' && data?.unreadCount"
        variant="outline"
        color="neutral"
        icon="i-lucide-check-check"
        label="Mark all read"
        @click="markAll"
      />
    </header>

    <div class="flex gap-1 border-b border-default">
      <button
        v-for="t in ['inbox', 'preferences'] as const"
        :key="t"
        class="border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors"
        :class="
          tab === t
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-default'
        "
        @click="tab = t"
      >
        {{ t }}
      </button>
    </div>

    <!-- INBOX -->
    <div v-show="tab === 'inbox'" class="space-y-3">
      <div class="flex gap-1">
        <UButton
          size="xs"
          :variant="filter === 'all' ? 'soft' : 'ghost'"
          :color="filter === 'all' ? 'primary' : 'neutral'"
          label="All"
          @click="filter = 'all'"
        />
        <UButton
          size="xs"
          :variant="filter === 'unread' ? 'soft' : 'ghost'"
          :color="filter === 'unread' ? 'primary' : 'neutral'"
          :label="`Unread (${data?.unreadCount ?? 0})`"
          @click="filter = 'unread'"
        />
      </div>
      <div
        v-if="!shown.length"
        class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
      >
        You're all caught up.
      </div>
      <ul
        v-else
        class="overflow-hidden rounded-xl border border-default bg-default shadow-sm divide-y divide-default"
      >
        <li
          v-for="n in shown"
          :key="n.id"
          class="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-elevated/40"
          :class="!n.readAt ? 'bg-primary/5' : ''"
          @click="open(n)"
        >
          <span
            class="mt-1.5 size-2 shrink-0 rounded-full"
            :class="!n.readAt ? 'bg-primary' : 'bg-transparent'"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-default">{{ n.title }}</p>
            <p v-if="n.body" class="truncate text-xs text-muted">{{ n.body }}</p>
          </div>
          <div class="shrink-0 text-right">
            <UBadge variant="subtle" color="neutral" size="xs" :label="catLabel(n.type)" />
            <p class="mt-1 text-[10px] text-dimmed">{{ when(n.createdAt) }}</p>
          </div>
        </li>
      </ul>
    </div>

    <!-- PREFERENCES -->
    <div v-show="tab === 'preferences'" class="max-w-2xl space-y-4">
      <UCard>
        <template #header>
          <div>
            <h3 class="text-sm font-semibold text-default">Email notifications</h3>
            <p class="mt-0.5 text-xs text-muted">
              In-app alerts are always on. Choose which categories also email you.
            </p>
          </div>
        </template>
        <div class="space-y-3">
          <div
            v-for="c in NOTIFICATION_CATEGORIES"
            :key="c.key"
            class="flex items-start justify-between gap-4"
          >
            <div>
              <p class="text-sm font-medium text-default">{{ c.label }}</p>
              <p class="text-xs text-muted">{{ c.help }}</p>
            </div>
            <USwitch v-model="emailByCategory[c.key]" />
          </div>
        </div>
      </UCard>
      <UCard>
        <template #header><h3 class="text-sm font-semibold text-default">Digest</h3></template>
        <UFormField label="Summary email frequency">
          <USelect v-model="digest" :items="digestItems" value-key="value" class="w-56" />
        </UFormField>
      </UCard>
      <div class="flex justify-end">
        <UButton label="Save preferences" :loading="savingPrefs" @click="savePrefs" />
      </div>
    </div>
  </div>
</template>
