<script setup lang="ts">
import {
  EXPERT_AVAILABILITIES,
  EXPERT_AVAILABILITY_COLOR,
  EXPERT_AVAILABILITY_LABEL,
  type ExpertAvailability,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Expert Database — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

interface Expert {
  userId: string
  firstName: string | null
  lastName: string | null
  headline: string | null
  yearsExperience: number | null
  dailyRate: string | null
  currency: string
  availability: ExpertAvailability
  skills: string[]
  languages: { language: string; proficiency: string }[]
  sectors: string[]
}

// Nuxt UI USelect can't take an empty-string value, so "any" uses a sentinel.
const ANY = '__any__'
const f = reactive({ q: '', skill: '', language: '', availability: ANY, maxRate: '', sector: '' })
const query = computed(() => ({
  q: f.q || undefined,
  skill: f.skill || undefined,
  language: f.language || undefined,
  availability: f.availability && f.availability !== ANY ? f.availability : undefined,
  maxRate: f.maxRate || undefined,
  sector: f.sector || undefined,
}))
const { data, status } = await useFetch<{
  items: Expert[]
  facets: { skills: string[]; sectors: string[] }
}>('/api/experts', {
  query,
  key: 'experts',
  default: () => ({ items: [], facets: { skills: [], sectors: [] } }),
})
const availItems = [
  { label: 'Any availability', value: ANY },
  ...EXPERT_AVAILABILITIES.map((a) => ({
    label: EXPERT_AVAILABILITY_LABEL[a],
    value: a as string,
  })),
]
// Client-side pagination for the results grid.
const page = ref(1)
const pageSize = 12
const paged = computed(() =>
  (data.value?.items ?? []).slice((page.value - 1) * pageSize, page.value * pageSize)
)
watch(
  () => data.value?.items,
  () => {
    page.value = 1
  }
)
const name = (e: Expert) => [e.firstName, e.lastName].filter(Boolean).join(' ') || 'Expert'
function rate(e: Expert) {
  return e.dailyRate
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: e.currency,
        maximumFractionDigits: 0,
      }).format(Number(e.dailyRate))
    : null
}
function reset() {
  Object.assign(f, { q: '', skill: '', language: '', availability: ANY, maxRate: '', sector: '' })
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Expert Database</h1>
        <p class="mt-1 text-sm text-muted">
          Find the right consultant by skill, language, availability, and rate.
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          to="/experts/utilisation"
          variant="outline"
          color="neutral"
          icon="i-lucide-bar-chart-3"
          label="Utilisation"
        />
        <UButton
          to="/hr"
          variant="outline"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="People"
        />
      </div>
    </header>

    <!-- Filters -->
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <UInput v-model="f.q" icon="i-lucide-search" placeholder="Keyword" />
      <UInput v-model="f.skill" icon="i-lucide-wrench" placeholder="Skill" list="skill-list" />
      <datalist id="skill-list">
        <option v-for="s in data.facets.skills" :key="s" :value="s" />
      </datalist>
      <UInput v-model="f.language" icon="i-lucide-languages" placeholder="Language" />
      <UInput v-model="f.sector" icon="i-lucide-layers" placeholder="Sector" list="sector-list" />
      <datalist id="sector-list">
        <option v-for="s in data.facets.sectors" :key="s" :value="s" />
      </datalist>
      <USelect v-model="f.availability" :items="availItems" value-key="value" />
      <UInput
        v-model="f.maxRate"
        type="number"
        icon="i-lucide-dollar-sign"
        placeholder="Max rate/day"
      />
    </div>
    <div class="flex items-center justify-between">
      <span class="text-xs text-muted">{{ data.items.length }} expert(s)</span>
      <UButton size="xs" variant="link" color="neutral" label="Clear filters" @click="reset" />
    </div>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>
    <div
      v-else-if="!data.items.length"
      class="rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-graduation-cap" class="size-10 text-muted" />
      <p class="mt-2 text-sm text-muted">
        No experts match. Build profiles from a staff member's page.
      </p>
    </div>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <button
        v-for="e in paged"
        :key="e.userId"
        type="button"
        class="rounded-xl border border-default bg-default p-4 text-left transition-colors hover:border-primary/50 hover:bg-elevated/30"
        @click="navigateTo(`/experts/${e.userId}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-semibold text-default">{{ name(e) }}</p>
            <p class="text-xs text-muted">{{ e.headline ?? '—' }}</p>
          </div>
          <UBadge
            :color="EXPERT_AVAILABILITY_COLOR[e.availability]"
            variant="subtle"
            size="xs"
            :label="EXPERT_AVAILABILITY_LABEL[e.availability]"
          />
        </div>
        <div class="mt-3 flex flex-wrap gap-1">
          <UBadge
            v-for="s in e.skills.slice(0, 5)"
            :key="s"
            color="neutral"
            variant="subtle"
            size="xs"
            :label="s"
          />
          <span v-if="e.skills.length > 5" class="text-xs text-muted"
            >+{{ e.skills.length - 5 }}</span
          >
        </div>
        <div class="mt-3 flex items-center justify-between text-xs text-muted">
          <span>{{ e.languages.map((l) => l.language).join(', ') || '—' }}</span>
          <span class="flex items-center gap-2">
            <span v-if="e.yearsExperience != null">{{ e.yearsExperience }}y</span>
            <span v-if="rate(e)" class="font-medium text-default">{{ rate(e) }}/day</span>
          </span>
        </div>
      </button>
    </div>

    <div v-if="(data.items?.length ?? 0) > pageSize" class="flex justify-center">
      <UPagination
        v-model:page="page"
        :total="data.items.length"
        :items-per-page="pageSize"
        :sibling-count="1"
      />
    </div>
  </div>
</template>
