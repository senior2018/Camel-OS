<script setup lang="ts">
import {
  MILESTONE_STATUS_COLOR,
  MILESTONE_STATUS_LABEL,
  type MilestoneStatus,
  PROJECT_STATUS_COLOR,
  PROJECT_STATUS_LABEL,
  type ProjectStatus,
} from '@@/shared/schemas/project'

definePageMeta({ layout: false })
const route = useRoute()
const token = route.params.token as string

interface Milestone {
  id: string
  name: string
  dueDate: string | null
  status: MilestoneStatus
}
interface Indicator {
  id: string
  name: string
  level: string
  target: string | null
  baseline: string | null
  unit: string | null
  latest: number | null
}
interface Portal {
  project: {
    id: string
    name: string
    status: ProjectStatus
    startDate: string | null
    endDate: string | null
    clientName: string | null
  }
  milestones: Milestone[]
  indicators: Indicator[]
  reports: { title: string; updatedAt: string }[]
}

const { data, error } = await useFetch<Portal>(`/api/public/portal/${token}`, {
  key: `portal-${token}`,
})
useHead({ title: data.value ? `${data.value.project.name} — Progress` : 'Project Portal' })

function fdate(s: string | null) {
  return s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
}
function indStatus(i: Indicator) {
  const t = i.target != null ? Number(i.target) : null
  if (t == null || i.latest == null) return 'bg-neutral-300'
  if (i.latest >= t) return 'bg-success'
  if (i.latest >= t * 0.5) return 'bg-warning'
  return 'bg-error'
}
function pct(i: Indicator) {
  const t = i.target != null ? Number(i.target) : null
  if (!t || i.latest == null) return 0
  return Math.min(100, Math.round((i.latest / t) * 100))
}
const doneMs = computed(
  () => data.value?.milestones.filter((m) => m.status === 'completed').length ?? 0
)
</script>

<template>
  <div class="min-h-screen bg-elevated/30">
    <header class="border-b border-default bg-default">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <AppLogo variant="full" />
        <span class="text-xs text-muted">Client portal · read-only</span>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-8">
      <div v-if="error" class="rounded-xl border border-dashed border-default p-12 text-center">
        <UIcon name="i-lucide-lock" class="size-10 text-muted" />
        <p class="mt-2 text-sm text-muted">This portal link is invalid or has been disabled.</p>
      </div>

      <div v-else-if="data" class="space-y-6">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-semibold tracking-tight text-default">
              {{ data.project.name }}
            </h1>
            <UBadge
              :color="PROJECT_STATUS_COLOR[data.project.status]"
              variant="subtle"
              :label="PROJECT_STATUS_LABEL[data.project.status]"
            />
          </div>
          <p class="mt-1 text-sm text-muted">
            {{ data.project.clientName || '' }} · {{ fdate(data.project.startDate) }} –
            {{ fdate(data.project.endDate) }}
          </p>
        </div>

        <!-- Milestones -->
        <section class="rounded-xl border border-default bg-default p-5">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-default">Milestones</h2>
            <span class="text-xs text-muted"
              >{{ doneMs }}/{{ data.milestones.length }} complete</span
            >
          </div>
          <ul v-if="data.milestones.length" class="space-y-2">
            <li
              v-for="m in data.milestones"
              :key="m.id"
              class="flex items-center justify-between gap-2 text-sm"
            >
              <span class="text-default">{{ m.name }}</span>
              <span class="flex items-center gap-2 text-xs text-muted">
                {{ fdate(m.dueDate) }}
                <UBadge
                  :color="MILESTONE_STATUS_COLOR[m.status]"
                  variant="subtle"
                  size="xs"
                  :label="MILESTONE_STATUS_LABEL[m.status]"
                />
              </span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">No milestones published.</p>
        </section>

        <!-- Indicators -->
        <section class="rounded-xl border border-default bg-default p-5">
          <h2 class="mb-3 text-sm font-semibold text-default">Performance indicators</h2>
          <ul v-if="data.indicators.length" class="space-y-3">
            <li v-for="i in data.indicators" :key="i.id">
              <div class="flex items-center justify-between text-sm">
                <span class="flex items-center gap-2 text-default"
                  ><span class="size-2 rounded-full" :class="indStatus(i)" />{{ i.name }}</span
                >
                <span class="text-muted"
                  >{{ i.latest ?? '—' }} / {{ i.target ?? '—' }} {{ i.unit || '' }}</span
                >
              </div>
              <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${pct(i)}%` }" />
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">No indicators published.</p>
        </section>

        <!-- Reports -->
        <section v-if="data.reports.length" class="rounded-xl border border-default bg-default p-5">
          <h2 class="mb-3 text-sm font-semibold text-default">Approved reports</h2>
          <ul class="space-y-1.5 text-sm">
            <li v-for="(r, i) in data.reports" :key="i" class="flex items-center justify-between">
              <span class="text-default">{{ r.title }}</span
              ><span class="text-xs text-muted">{{ fdate(r.updatedAt) }}</span>
            </li>
          </ul>
        </section>

        <p class="text-center text-xs text-dimmed">Data is read-only and refreshed periodically.</p>
      </div>
    </main>
  </div>
</template>
