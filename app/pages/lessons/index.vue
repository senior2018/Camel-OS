<script setup lang="ts">
import { lessonSchema } from '@@/shared/schemas/mel'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Lessons Learned — Camel OS' })

const { can } = await usePermissions()
if (!can.value('mel', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canCreate = computed(() => can.value('mel', 'create'))
const canDelete = computed(() => can.value('mel', 'update'))

interface Lesson {
  id: string
  title: string
  description: string | null
  sector: string | null
  tags: string[]
  projectName: string | null
  authorFirstName: string | null
  authorLastName: string | null
  createdAt: string
}

const search = ref('')
const sector = ref<string | undefined>(undefined)
const tagFilter = ref('')
const query = computed(() => ({ q: search.value || undefined, sector: sector.value || undefined }))
const { data, refresh } = await useFetch<{ items: Lesson[]; sectors: string[] }>(
  '/api/mel/lessons',
  {
    query,
    key: 'lessons',
    default: () => ({ items: [], sectors: [] }),
  }
)
const sectorItems = computed(() => [
  { label: 'All sectors', value: '' },
  ...(data.value?.sectors ?? []).map((s) => ({ label: s, value: s })),
])
const filtered = computed(() => {
  const t = tagFilter.value.trim().toLowerCase()
  return (data.value?.items ?? []).filter(
    (l) => !t || l.tags.some((x) => x.toLowerCase().includes(t))
  )
})

const toast = useToast()
const createOpen = ref(false)
const creating = ref(false)
const form = reactive({ title: '', description: '', sector: '', tags: '' })
async function create() {
  const parsed = lessonSchema.safeParse({
    title: form.title,
    description: form.description || null,
    sector: form.sector || null,
    tags: form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  })
  if (!parsed.success) {
    toast.add({ title: 'A title is required', color: 'warning' })
    return
  }
  creating.value = true
  try {
    await $fetch('/api/mel/lessons', { method: 'POST', body: parsed.data })
    createOpen.value = false
    form.title = ''
    form.description = ''
    form.sector = ''
    form.tags = ''
    await refresh()
  } catch {
    toast.add({ title: 'Could not save lesson', color: 'error' })
  } finally {
    creating.value = false
  }
}
async function del(l: Lesson) {
  await $fetch(`/api/mel/lessons/${l.id}`, { method: 'DELETE' })
  await refresh()
}
function authorName(l: Lesson) {
  return [l.authorFirstName, l.authorLastName].filter(Boolean).join(' ') || '—'
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Lessons Learned</h1>
        <p class="mt-1 text-sm text-muted">
          Institutional knowledge captured from project evaluations.
        </p>
      </div>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        label="Capture lesson"
        @click="createOpen = true"
      />
    </header>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search lessons…"
        class="sm:max-w-xs"
      />
      <USelect
        v-model="sector"
        :items="sectorItems"
        value-key="value"
        placeholder="Sector"
        class="sm:w-44"
      />
      <UInput
        v-model="tagFilter"
        icon="i-lucide-tag"
        placeholder="Filter by tag…"
        class="sm:w-44"
      />
      <span class="text-xs text-muted sm:ml-auto">{{ filtered.length }} shown</span>
    </div>

    <div
      v-if="!filtered.length"
      class="rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-lightbulb" class="size-10 text-muted" />
      <p class="mt-2 text-sm text-muted">No lessons match your search.</p>
    </div>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <UCard v-for="l in filtered" :key="l.id">
        <template #header>
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold text-default">{{ l.title }}</h3>
            <UButton
              v-if="canDelete"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Delete"
              @click="del(l)"
            />
          </div>
        </template>
        <p v-if="l.description" class="text-sm text-muted">{{ l.description }}</p>
        <div class="mt-3 flex flex-wrap items-center gap-1.5">
          <UBadge v-if="l.sector" color="info" variant="subtle" size="xs" :label="l.sector" />
          <UBadge
            v-for="t in l.tags"
            :key="t"
            color="neutral"
            variant="subtle"
            size="xs"
            :label="t"
          />
        </div>
        <p class="mt-2 text-xs text-dimmed">
          {{ l.projectName ? `${l.projectName} · ` : '' }}{{ authorName(l) }}
        </p>
      </UCard>
    </div>

    <UModal v-model:open="createOpen" title="Capture a lesson">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title" required
            ><UInput v-model="form.title" autofocus placeholder="What was learned?"
          /></UFormField>
          <UFormField label="Detail"
            ><UTextarea
              v-model="form.description"
              :rows="3"
              class="w-full"
              placeholder="Context, what happened, recommendation…"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Sector"
              ><UInput v-model="form.sector" placeholder="e.g. Health"
            /></UFormField>
            <UFormField label="Tags" hint="comma-separated"
              ><UInput v-model="form.tags" placeholder="data, fieldwork"
            /></UFormField>
          </div>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="createOpen = false"
          /><UButton label="Save lesson" :loading="creating" @click="create" /></div
      ></template>
    </UModal>
  </div>
</template>
