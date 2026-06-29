<script setup lang="ts">
import {
  PROJECT_STATUS_COLOR,
  PROJECT_STATUS_LABEL,
  createProjectSchema,
  type ProjectStatus,
} from '@@/shared/schemas/project'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Projects — Camel OS' })

const { can } = await usePermissions()
if (!can.value('project', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access to Projects', fatal: true })
}
const canCreate = computed(() => can.value('project', 'create'))

interface ProjectRow {
  id: string
  name: string
  code: string | null
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  totalBudget: string | null
  currency: string
  clientName: string | null
  pmFirstName: string | null
  pmLastName: string | null
  milestonesTotal: number
  milestonesDone: number
}

const { data, status } = await useFetch<{ items: ProjectRow[] }>('/api/projects', {
  key: 'projects-list',
  default: () => ({ items: [] }),
})

const search = ref('')
const statusFilter = ref<ProjectStatus[]>([])
const statusOptions = (Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => ({
  label: PROJECT_STATUS_LABEL[s],
  value: s,
}))
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (data.value?.items ?? []).filter((p) => {
    if (statusFilter.value.length && !statusFilter.value.includes(p.status)) return false
    if (q && !`${p.name} ${p.code ?? ''} ${p.clientName ?? ''}`.toLowerCase().includes(q))
      return false
    return true
  })
})

const toast = useToast()
const createOpen = ref(false)
const creating = ref(false)
const form = reactive({
  name: '',
  code: '',
  startDate: '',
  endDate: '',
  totalBudget: null as number | null,
  currency: 'USD',
  scope: '',
})
async function create() {
  const parsed = createProjectSchema.safeParse({
    name: form.name,
    code: form.code || null,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    totalBudget: form.totalBudget,
    currency: form.currency || 'USD',
    scope: form.scope || null,
  })
  if (!parsed.success) {
    toast.add({ title: 'A project name is required', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const res = await $fetch<{ project: { id: string } }>('/api/projects', {
      method: 'POST',
      body: parsed.data,
    })
    createOpen.value = false
    await navigateTo(`/projects/${res.project.id}`)
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not create project', description: msg, color: 'error' })
  } finally {
    creating.value = false
  }
}

function pmName(p: ProjectRow) {
  return [p.pmFirstName, p.pmLastName].filter(Boolean).join(' ') || 'Unassigned'
}
function money(v: string | null, currency: string) {
  return v == null
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(Number(v))
}
function progress(p: ProjectRow) {
  return p.milestonesTotal ? Math.round((p.milestonesDone / p.milestonesTotal) * 100) : 0
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Projects</h1>
        <p class="mt-1 text-sm text-muted">
          Deliver won work — teams, milestones, budgets, and reporting in one place.
        </p>
      </div>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        label="New project"
        @click="createOpen = true"
      />
    </header>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search by name, code, or client…"
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
      <UIcon name="i-lucide-briefcase" class="size-10 text-muted" />
      <h2 class="text-lg font-semibold text-default">No projects yet</h2>
      <p class="max-w-md text-sm text-muted">
        Projects appear here automatically when a proposal's contract is signed — or create one
        manually.
      </p>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        label="New project"
        @click="createOpen = true"
      />
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="p in filtered"
        :key="p.id"
        class="flex cursor-pointer flex-col rounded-xl border border-default bg-default p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow"
        @click="navigateTo(`/projects/${p.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h2 class="truncate font-semibold text-default">{{ p.name }}</h2>
            <p v-if="p.code" class="text-xs text-dimmed">{{ p.code }}</p>
          </div>
          <UBadge
            :color="PROJECT_STATUS_COLOR[p.status]"
            variant="subtle"
            size="xs"
            :label="PROJECT_STATUS_LABEL[p.status]"
          />
        </div>
        <p class="mt-1 truncate text-sm text-muted">{{ p.clientName || 'No client linked' }}</p>

        <div class="mt-3 space-y-1">
          <div class="flex items-center justify-between text-xs text-muted">
            <span>Milestones</span>
            <span class="font-medium text-default"
              >{{ p.milestonesDone }}/{{ p.milestonesTotal }}</span
            >
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${progress(p)}%` }" />
          </div>
        </div>

        <div
          class="mt-3 flex items-center justify-between border-t border-default pt-3 text-xs text-muted"
        >
          <span class="truncate"
            ><UIcon name="i-lucide-user" class="mr-1 inline size-3" />{{ pmName(p) }}</span
          >
          <span>{{ money(p.totalBudget, p.currency) }}</span>
        </div>
      </article>
    </div>

    <UModal v-model:open="createOpen" title="New project">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required>
            <UInput
              v-model="form.name"
              placeholder="e.g. Climate Resilience Programme — Phase 1"
              autofocus
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Code"
              ><UInput v-model="form.code" placeholder="TZ-2026-04"
            /></UFormField>
            <UFormField label="Currency"
              ><UInput v-model="form.currency" maxlength="3"
            /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Start"><UInput v-model="form.startDate" type="date" /></UFormField>
            <UFormField label="End"><UInput v-model="form.endDate" type="date" /></UFormField>
          </div>
          <UFormField label="Total budget">
            <UInputNumber v-model="form.totalBudget" :min="0" placeholder="0" class="w-full" />
          </UFormField>
          <UFormField label="Scope">
            <UTextarea
              v-model="form.scope"
              :rows="2"
              class="w-full"
              placeholder="What this engagement delivers…"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="createOpen = false" />
          <UButton label="Create project" :loading="creating" @click="create" />
        </div>
      </template>
    </UModal>
  </div>
</template>
