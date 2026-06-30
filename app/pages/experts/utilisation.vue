<script setup lang="ts">
import {
  EXPERT_AVAILABILITIES,
  EXPERT_AVAILABILITY_COLOR,
  EXPERT_AVAILABILITY_LABEL,
  type ExpertAvailability,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Expert Utilisation — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

const { data } = await useFetch<{
  total: number
  assigned: number
  utilisation: number
  byAvailability: Record<ExpertAvailability, number>
  avgRate: number
  topSkills: { skill: string; count: number }[]
}>('/api/experts/utilisation', {
  key: 'expert-utilisation',
  default: () => ({
    total: 0,
    assigned: 0,
    utilisation: 0,
    byAvailability: { available: 0, partially_available: 0, unavailable: 0 },
    avgRate: 0,
    topSkills: [],
  }),
})
const maxSkill = computed(() => Math.max(1, ...(data.value?.topSkills ?? []).map((s) => s.count)))
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Expert Utilisation</h1>
        <p class="mt-1 text-sm text-muted">Capacity and deployment across the Expert Database.</p>
      </div>
      <UButton
        to="/experts"
        variant="link"
        color="neutral"
        icon="i-lucide-arrow-left"
        label="Expert Database"
      />
    </header>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Experts</p>
        <p class="mt-1 text-2xl font-semibold text-default">{{ data.total }}</p>
      </div>
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">On a project</p>
        <p class="mt-1 text-2xl font-semibold text-default">{{ data.assigned }}</p>
      </div>
      <div class="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Utilisation</p>
        <p class="mt-1 text-2xl font-semibold text-primary">{{ data.utilisation }}%</p>
      </div>
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Avg day rate</p>
        <p class="mt-1 text-2xl font-semibold text-default">{{ data.avgRate || '—' }}</p>
      </div>
    </div>

    <UCard>
      <template #header><h3 class="text-sm font-semibold text-default">Availability</h3></template>
      <div class="space-y-2">
        <div v-for="a in EXPERT_AVAILABILITIES" :key="a" class="flex items-center gap-3">
          <UBadge
            :color="EXPERT_AVAILABILITY_COLOR[a]"
            variant="subtle"
            size="xs"
            :label="EXPERT_AVAILABILITY_LABEL[a]"
            class="w-36 shrink-0 justify-center"
          />
          <div class="h-2 flex-1 rounded-full bg-elevated">
            <div
              class="h-full rounded-full bg-primary"
              :style="{ width: `${data.total ? (data.byAvailability[a] / data.total) * 100 : 0}%` }"
            />
          </div>
          <span class="w-8 text-right text-sm text-muted">{{ data.byAvailability[a] }}</span>
        </div>
      </div>
    </UCard>

    <UCard v-if="data.topSkills.length">
      <template #header
        ><h3 class="text-sm font-semibold text-default">Top skills (coverage)</h3></template
      >
      <div class="space-y-1.5">
        <div v-for="s in data.topSkills" :key="s.skill" class="flex items-center gap-3 text-sm">
          <span class="w-40 shrink-0 truncate text-default">{{ s.skill }}</span>
          <div class="h-2 flex-1 rounded-full bg-elevated">
            <div
              class="h-full rounded-full bg-info"
              :style="{ width: `${(s.count / maxSkill) * 100}%` }"
            />
          </div>
          <span class="w-8 text-right text-muted">{{ s.count }}</span>
        </div>
      </div>
    </UCard>
  </div>
</template>
