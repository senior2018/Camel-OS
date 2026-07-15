<script setup lang="ts">
import CommunicationsTabs from '~/components/communication/CommunicationsTabs.vue'
import {
  CONTENT_STATUSES,
  CONTENT_STATUS_COLOR,
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_LABEL,
  createContentSchema,
  type ContentStatus,
} from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Communications — Camel OS' })

const { can } = await usePermissions()
const isContentTeam = computed(
  () =>
    can.value('communications', 'create') ||
    can.value('communications', 'update') ||
    can.value('communications', 'approve')
)
if (!isContentTeam.value) {
  throw createError({
    statusCode: 403,
    statusMessage: 'The Communications workspace is for the content team.',
    fatal: true,
  })
}

const canCreate = computed(() => can.value('communications', 'create'))

interface ContentRow {
  id: string
  title: string
  type: string
  category: string | null
  excerpt: string | null
  tags: string[]
  status: ContentStatus
  authorFirstName: string | null
  authorLastName: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

const { data, status } = await useFetch<{ items: ContentRow[] }>('/api/communications/content', {
  key: 'communications-content',
  default: () => ({ items: [] }),
})

const search = ref('')
const statusFilter = ref<ContentStatus[]>([])
const statusOptions = CONTENT_STATUSES.map((s) => ({ label: CONTENT_STATUS_LABEL[s], value: s }))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (data.value?.items ?? []).filter((c) => {
    if (statusFilter.value.length && !statusFilter.value.includes(c.status)) return false
    if (q && !`${c.title} ${c.category ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
})

const counts = computed(() => {
  const m = Object.fromEntries(CONTENT_STATUSES.map((s) => [s, 0])) as Record<ContentStatus, number>
  for (const c of data.value?.items ?? []) m[c.status]++
  return m
})

const typeLabel = (t: string) => (CONTENT_TYPE_LABEL as Record<string, string>)[t] ?? t
function authorName(c: ContentRow) {
  return [c.authorFirstName, c.authorLastName].filter(Boolean).join(' ') || '—'
}
function when(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Create ──
const toast = useToast()
const createOpen = ref(false)
const form = reactive({ title: '', type: 'insight' })
const creating = ref(false)
// Content types come from settings (built-in defaults + org-defined values), so
// a leader can extend the vocabulary without a code change.
const { data: optionsData } = await useFetch<{ types: { key: string; label: string }[] }>(
  '/api/communications/settings/options',
  { key: 'comms-options', default: () => ({ types: [] }) }
)
const typeItems = computed(() =>
  (optionsData.value?.types ?? []).map((t) => ({ label: t.label, value: t.key }))
)

async function create() {
  const parsed = createContentSchema.safeParse({ title: form.title, type: form.type, tags: [] })
  if (!parsed.success) {
    toast.add({ title: 'A title is required', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const res = await $fetch<{ content: { id: string } }>('/api/communications/content', {
      method: 'POST',
      body: parsed.data,
    })
    createOpen.value = false
    form.title = ''
    await navigateTo(`/communications/${res.content.id}`)
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.'
    toast.add({ title: 'Could not create content', description: msg, color: 'error' })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <CommunicationsTabs class="-mt-1" />
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Communications</h1>
        <p class="mt-1 text-sm text-muted">
          Author insights and reports, run them through review, and publish to the staff library.
        </p>
      </div>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        label="New content"
        @click="createOpen = true"
      />
    </header>

    <!-- Status summary strip (CC-05) -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="s in CONTENT_STATUSES"
        :key="s"
        class="rounded-lg border border-default bg-default px-3 py-1.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow"
        :class="statusFilter.includes(s) ? 'ring-2 ring-primary' : ''"
        @click="
          statusFilter = statusFilter.includes(s)
            ? statusFilter.filter((x) => x !== s)
            : [...statusFilter, s]
        "
      >
        <span class="text-xs text-muted">{{ CONTENT_STATUS_LABEL[s] }}</span>
        <span class="ml-2 text-sm font-semibold text-default">{{ counts[s] }}</span>
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search by title or category…"
        class="sm:max-w-xs"
      />
      <USelectMenu
        v-model="statusFilter"
        :items="statusOptions"
        value-key="value"
        multiple
        placeholder="Any status"
        class="sm:w-56"
      />
      <span class="text-xs text-muted sm:ml-auto">{{ filtered.length }} shown</span>
    </div>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <div
      v-else-if="!filtered.length"
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-megaphone" class="size-10 text-muted" />
      <h2 class="text-lg font-semibold text-default">No content yet</h2>
      <p class="max-w-md text-sm text-muted">
        Create your first insight or report — draft it, send it for review, then publish.
      </p>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        label="New content"
        @click="createOpen = true"
      />
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Title</th>
            <th class="hidden px-4 py-2 font-medium sm:table-cell">Type</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="hidden px-4 py-2 font-medium md:table-cell">Author</th>
            <th class="hidden px-4 py-2 font-medium md:table-cell">Updated</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="c in filtered"
            :key="c.id"
            class="cursor-pointer transition-colors hover:bg-elevated/40"
            @click="navigateTo(`/communications/${c.id}`)"
          >
            <td class="px-4 py-2.5">
              <p class="font-medium text-default">{{ c.title }}</p>
              <p v-if="c.category" class="truncate text-xs text-muted">{{ c.category }}</p>
            </td>
            <td class="hidden px-4 py-2.5 text-muted sm:table-cell">{{ typeLabel(c.type) }}</td>
            <td class="px-4 py-2.5">
              <UBadge
                :color="CONTENT_STATUS_COLOR[c.status]"
                variant="subtle"
                size="xs"
                :label="CONTENT_STATUS_LABEL[c.status]"
              />
            </td>
            <td class="hidden px-4 py-2.5 text-muted md:table-cell">{{ authorName(c) }}</td>
            <td class="hidden px-4 py-2.5 text-muted md:table-cell">{{ when(c.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create modal -->
    <UModal v-model:open="createOpen" title="New content">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Title" required>
            <UInput
              v-model="form.title"
              placeholder="e.g. Q2 Sector Insight — Agriculture"
              autofocus
            />
          </UFormField>
          <UFormField label="Type">
            <USelect v-model="form.type" :items="typeItems" value-key="value" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="createOpen = false" />
          <UButton label="Create & edit" :loading="creating" @click="create" />
        </div>
      </template>
    </UModal>
  </div>
</template>
