<script setup lang="ts">
import CommunicationsTabs from '~/components/communication/CommunicationsTabs.vue'
import {
  ENGAGEMENT_STRATEGIES,
  STAKEHOLDER_LEVELS,
  STAKEHOLDER_LEVEL_LABEL,
  STAKEHOLDER_TYPES,
  createStakeholderSchema,
  type StakeholderLevel,
} from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Stakeholders — Camel OS' })

const { can } = await usePermissions()
const canManage = computed(
  () => can.value('communications', 'update') || can.value('communications', 'approve')
)
if (!canManage.value && !can.value('communications', 'create')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

interface Stakeholder {
  id: string
  name: string
  type: string | null
  sector: string | null
  geography: string | null
  influence: StakeholderLevel
  interest: StakeholderLevel
  engagementStrategy: string | null
  ownerFirstName: string | null
  ownerLastName: string | null
}

const { data, status } = await useFetch<{ items: Stakeholder[] }>(
  '/api/communications/stakeholders',
  { key: 'stakeholders', default: () => ({ items: [] }) }
)

// Matrix: influence (rows, high→low) × interest (cols, low→high).
const infRows: StakeholderLevel[] = ['high', 'medium', 'low']
const intCols: StakeholderLevel[] = ['low', 'medium', 'high']
const byCell = computed(() => {
  const m: Record<string, Stakeholder[]> = {}
  for (const s of data.value?.items ?? []) {
    ;(m[`${s.influence}-${s.interest}`] ??= []).push(s)
  }
  return m
})
function quadrantHint(inf: StakeholderLevel, int: StakeholderLevel) {
  if (inf === 'high' && int === 'high') return 'Manage closely'
  if (inf === 'high') return 'Keep satisfied'
  if (int === 'high') return 'Keep informed'
  return 'Monitor'
}

// ── Create ──
const toast = useToast()
const createOpen = ref(false)
const creating = ref(false)
const form = reactive({
  name: '',
  type: 'Government',
  sector: '',
  geography: '',
  influence: 'medium' as StakeholderLevel,
  interest: 'medium' as StakeholderLevel,
  engagementStrategy: '',
})
const levelItems = STAKEHOLDER_LEVELS.map((l) => ({ label: STAKEHOLDER_LEVEL_LABEL[l], value: l }))
const typeItems = STAKEHOLDER_TYPES.map((t) => ({ label: t, value: t as string }))
const strategyItems = ENGAGEMENT_STRATEGIES.map((s) => ({ label: s, value: s as string }))
async function create() {
  const parsed = createStakeholderSchema.safeParse({
    name: form.name,
    type: form.type || null,
    sector: form.sector || null,
    geography: form.geography || null,
    influence: form.influence,
    interest: form.interest,
    engagementStrategy: form.engagementStrategy || null,
  })
  if (!parsed.success) {
    toast.add({ title: 'A name is required', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const res = await $fetch<{ stakeholder: { id: string } }>('/api/communications/stakeholders', {
      method: 'POST',
      body: parsed.data,
    })
    createOpen.value = false
    await navigateTo(`/stakeholders/${res.stakeholder.id}`)
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not create', description: msg, color: 'error' })
  } finally {
    creating.value = false
  }
}

const dot: Record<StakeholderLevel, string> = {
  high: 'bg-error',
  medium: 'bg-warning',
  low: 'bg-success',
}
</script>

<template>
  <div class="space-y-6">
    <CommunicationsTabs class="-mt-1" />
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Stakeholders</h1>
        <p class="mt-1 text-sm text-muted">
          Map who matters by influence and interest, then engage them deliberately.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-file-bar-chart"
          label="Engagement report"
          @click="navigateTo('/stakeholders/report')"
        />
        <UButton
          v-if="canManage"
          icon="i-lucide-plus"
          label="New stakeholder"
          @click="createOpen = true"
        />
      </div>
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else>
      <!-- Influence / interest matrix (CC-14) -->
      <div class="rounded-xl border border-default bg-default shadow-sm p-4">
        <div class="flex">
          <div class="flex w-6 items-center justify-center">
            <span
              class="-rotate-90 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted"
            >
              Influence →
            </span>
          </div>
          <div class="flex-1">
            <div class="grid grid-cols-3 gap-2">
              <template v-for="inf in infRows" :key="inf">
                <div
                  v-for="int in intCols"
                  :key="`${inf}-${int}`"
                  class="min-h-28 rounded-lg border border-default bg-elevated/60 p-2"
                >
                  <p class="mb-1 text-[10px] font-medium uppercase tracking-wide text-dimmed">
                    {{ quadrantHint(inf, int) }}
                  </p>
                  <div class="flex flex-wrap gap-1">
                    <button
                      v-for="s in byCell[`${inf}-${int}`] ?? []"
                      :key="s.id"
                      class="max-w-full truncate rounded-full border border-default bg-default px-2 py-0.5 text-xs text-default transition-colors hover:border-primary/40"
                      :title="s.name"
                      @click="navigateTo(`/stakeholders/${s.id}`)"
                    >
                      {{ s.name }}
                    </button>
                  </div>
                </div>
              </template>
            </div>
            <div class="mt-1 text-center text-xs font-medium uppercase tracking-wide text-muted">
              Interest →
            </div>
          </div>
        </div>
      </div>

      <!-- Register -->
      <div
        v-if="data?.items.length"
        class="overflow-hidden rounded-xl border border-default bg-default shadow-sm"
      >
        <table class="w-full text-sm">
          <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Name</th>
              <th class="hidden px-4 py-2 font-medium sm:table-cell">Type</th>
              <th class="px-4 py-2 font-medium">Influence</th>
              <th class="px-4 py-2 font-medium">Interest</th>
              <th class="hidden px-4 py-2 font-medium md:table-cell">Strategy</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="s in data.items"
              :key="s.id"
              class="cursor-pointer hover:bg-elevated/40"
              @click="navigateTo(`/stakeholders/${s.id}`)"
            >
              <td class="px-4 py-2.5 font-medium text-default">{{ s.name }}</td>
              <td class="hidden px-4 py-2.5 text-muted sm:table-cell">{{ s.type || '—' }}</td>
              <td class="px-4 py-2.5">
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2 rounded-full" :class="dot[s.influence]" />
                  {{ STAKEHOLDER_LEVEL_LABEL[s.influence] }}
                </span>
              </td>
              <td class="px-4 py-2.5">
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2 rounded-full" :class="dot[s.interest]" />
                  {{ STAKEHOLDER_LEVEL_LABEL[s.interest] }}
                </span>
              </td>
              <td class="hidden px-4 py-2.5 text-muted md:table-cell">
                {{ s.engagementStrategy || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else
        class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
      >
        No stakeholders yet.
      </div>
    </template>

    <!-- Create modal -->
    <UModal v-model:open="createOpen" title="New stakeholder">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required>
            <UInput v-model="form.name" placeholder="e.g. Ministry of Agriculture" autofocus />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Type">
              <USelect v-model="form.type" :items="typeItems" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Sector">
              <UInput v-model="form.sector" placeholder="e.g. Public" />
            </UFormField>
          </div>
          <UFormField label="Geography">
            <UInput v-model="form.geography" placeholder="e.g. Tanzania" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Influence">
              <USelect
                v-model="form.influence"
                :items="levelItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Interest">
              <USelect
                v-model="form.interest"
                :items="levelItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Engagement strategy">
            <USelect
              v-model="form.engagementStrategy"
              :items="strategyItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="createOpen = false" />
          <UButton label="Create stakeholder" :loading="creating" @click="create" />
        </div>
      </template>
    </UModal>
  </div>
</template>
