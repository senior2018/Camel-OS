<script setup lang="ts">
import { MEL_LEVEL_LABEL, MEL_LEVELS, type BadgeColor, type MelLevel } from '@@/shared/schemas/mel'

const props = defineProps<{ projectId: string; canEdit: boolean; portalToken: string | null }>()
const emit = defineEmits<{ portalChanged: [] }>()
const toast = useToast()

interface Indicator {
  id: string
  parentId: string | null
  level: MelLevel
  name: string
  baseline: string | null
  target: string | null
  unit: string | null
  frequency: string | null
  dataSource: string | null
  orderIndex: number
}
interface DataPoint {
  id: string
  indicatorId: string
  periodDate: string
  value: string
  note: string | null
}

const { data, refresh } = await useFetch<{ indicators: Indicator[]; dataPoints: DataPoint[] }>(
  `/api/projects/${props.projectId}/mel`,
  { key: `mel-${props.projectId}` }
)

const pointsByIndicator = computed(() => {
  const m: Record<string, DataPoint[]> = {}
  for (const p of data.value?.dataPoints ?? []) (m[p.indicatorId] ??= []).push(p)
  return m
})
function latest(indId: string): number | null {
  const ps = pointsByIndicator.value[indId]
  return ps?.length ? Number(ps[ps.length - 1]!.value) : null
}
function statusOf(ind: Indicator): 'success' | 'warning' | 'error' | 'neutral' {
  const target = ind.target != null ? Number(ind.target) : null
  const val = latest(ind.id)
  if (target == null || val == null) return 'neutral'
  if (val >= target) return 'success'
  if (val >= target * 0.5) return 'warning'
  return 'error'
}
const dotClass = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-neutral-300 dark:bg-neutral-600',
}
function spark(indId: string): string {
  const ps = pointsByIndicator.value[indId] ?? []
  if (ps.length < 2) return ''
  const vals = ps.map((p) => Number(p.value))
  const max = Math.max(...vals, 1)
  const w = 80
  const h = 20
  return ps
    .map(
      (p, i) =>
        `${((i / (ps.length - 1)) * w).toFixed(1)},${(h - (Number(p.value) / max) * h).toFixed(1)}`
    )
    .join(' ')
}
const levelColor: Record<MelLevel, BadgeColor> = {
  goal: 'primary',
  outcome: 'info',
  output: 'neutral',
  indicator: 'success',
}

// ── Add indicator (ME-01) ──
const indOpen = ref(false)
const indForm = reactive({
  level: 'indicator' as MelLevel,
  name: '',
  baseline: null as number | null,
  target: null as number | null,
  unit: '',
  frequency: '',
  dataSource: '',
})
const levelItems = MEL_LEVELS.map((l) => ({ label: MEL_LEVEL_LABEL[l], value: l as string }))
const freqItems = ['Monthly', 'Quarterly', 'Bi-annual', 'Annual', 'Once'].map((f) => ({
  label: f,
  value: f,
}))
async function addIndicator() {
  if (!indForm.name.trim()) return
  try {
    await $fetch(`/api/projects/${props.projectId}/mel/indicators`, {
      method: 'POST',
      body: {
        level: indForm.level,
        name: indForm.name,
        baseline: indForm.baseline,
        target: indForm.target,
        unit: indForm.unit || null,
        frequency: indForm.frequency || null,
        dataSource: indForm.dataSource || null,
      },
    })
    indOpen.value = false
    indForm.name = ''
    indForm.baseline = null
    indForm.target = null
    indForm.unit = ''
    indForm.frequency = ''
    indForm.dataSource = ''
    await refresh()
  } catch {
    toast.add({ title: 'Could not add indicator', color: 'error' })
  }
}
async function delIndicator(ind: Indicator) {
  await $fetch(`/api/projects/${props.projectId}/mel/indicators/${ind.id}`, { method: 'DELETE' })
  await refresh()
}

// ── Record data (ME-02) ──
const dataOpen = ref(false)
const dataForm = reactive({
  indicatorId: '',
  periodDate: new Date().toISOString().slice(0, 10),
  value: null as number | null,
  note: '',
  evidenceUrl: '',
})
const indicatorItems = computed(() =>
  (data.value?.indicators ?? [])
    .filter((i) => i.level === 'indicator')
    .map((i) => ({ label: i.name, value: i.id }))
)
function openData(indId?: string) {
  dataForm.indicatorId = indId ?? indicatorItems.value[0]?.value ?? ''
  dataForm.value = null
  dataForm.note = ''
  dataOpen.value = true
}
async function recordData() {
  if (!dataForm.indicatorId || dataForm.value == null) return
  try {
    await $fetch(`/api/projects/${props.projectId}/mel/data`, {
      method: 'POST',
      body: {
        indicatorId: dataForm.indicatorId,
        periodDate: dataForm.periodDate,
        value: dataForm.value,
        note: dataForm.note || null,
        evidenceUrl: dataForm.evidenceUrl || '',
      },
    })
    dataOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Could not record data', color: 'error' })
  }
}

// ── Portal (ME-06) ──
const localToken = ref(props.portalToken)
watch(
  () => props.portalToken,
  (v) => (localToken.value = v)
)
const portalUrl = computed(() =>
  localToken.value && import.meta.client
    ? `${window.location.origin}/portal/${localToken.value}`
    : ''
)
async function togglePortal(enable: boolean) {
  try {
    const res = await $fetch<{ portalToken: string | null }>(
      `/api/projects/${props.projectId}/portal`,
      { method: 'POST', body: { enable } }
    )
    localToken.value = res.portalToken
    emit('portalChanged')
    toast.add({ title: enable ? 'Portal link enabled' : 'Portal disabled', color: 'success' })
  } catch {
    toast.add({ title: 'Could not update portal', color: 'error' })
  }
}
function copyLink() {
  if (portalUrl.value && import.meta.client) {
    navigator.clipboard.writeText(portalUrl.value)
    toast.add({ title: 'Link copied', color: 'success' })
  }
}

function exportCsv() {
  const rows = [['Indicator', 'Baseline', 'Target', 'Latest', 'Unit']]
  for (const i of (data.value?.indicators ?? []).filter((x) => x.level === 'indicator')) {
    rows.push([i.name, i.baseline ?? '', i.target ?? '', String(latest(i.id) ?? ''), i.unit ?? ''])
  }
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'mel-indicators.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div v-if="data" class="space-y-4">
    <div class="flex flex-wrap items-center justify-end gap-2">
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-lucide-download"
        label="Export"
        @click="exportCsv"
      />
      <UButton
        v-if="canEdit"
        size="sm"
        variant="outline"
        icon="i-lucide-plus"
        label="Indicator"
        @click="indOpen = true"
      />
      <UButton
        v-if="canEdit && indicatorItems.length"
        size="sm"
        icon="i-lucide-pen-line"
        label="Record data"
        @click="openData()"
      />
    </div>

    <!-- Results framework + dashboard (ME-01/03) -->
    <UCard>
      <template #header
        ><h3 class="text-sm font-semibold text-default">Results framework</h3></template
      >
      <div v-if="!data.indicators.length" class="py-6 text-center text-sm text-muted">
        No indicators yet. Build the results framework — goals, outcomes, outputs, and measurable
        indicators.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="py-1.5 pr-2 font-medium">Result / Indicator</th>
              <th class="py-1.5 px-2 text-right font-medium">Baseline</th>
              <th class="py-1.5 px-2 text-right font-medium">Target</th>
              <th class="py-1.5 px-2 text-right font-medium">Latest</th>
              <th class="py-1.5 px-2 font-medium">Trend</th>
              <th class="py-1.5 px-2 font-medium">Status</th>
              <th v-if="canEdit" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="ind in data.indicators" :key="ind.id">
              <td class="py-2 pr-2">
                <div
                  class="flex items-center gap-2"
                  :style="{
                    paddingLeft: `${{ goal: 0, outcome: 12, output: 24, indicator: 36 }[ind.level] ?? 0}px`,
                  }"
                >
                  <UBadge
                    :color="levelColor[ind.level]"
                    variant="subtle"
                    size="xs"
                    :label="MEL_LEVEL_LABEL[ind.level]"
                  />
                  <span class="text-default">{{ ind.name }}</span>
                  <span v-if="ind.unit" class="text-xs text-dimmed">({{ ind.unit }})</span>
                </div>
              </td>
              <td class="py-2 px-2 text-right text-muted">{{ ind.baseline ?? '—' }}</td>
              <td class="py-2 px-2 text-right text-muted">{{ ind.target ?? '—' }}</td>
              <td class="py-2 px-2 text-right font-medium text-default">
                {{ latest(ind.id) ?? '—' }}
              </td>
              <td class="py-2 px-2">
                <svg v-if="spark(ind.id)" viewBox="0 0 80 20" class="h-5 w-20">
                  <polyline
                    :points="spark(ind.id)"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    class="text-primary"
                  />
                </svg>
                <span v-else class="text-xs text-dimmed">—</span>
              </td>
              <td class="py-2 px-2">
                <span
                  v-if="ind.level === 'indicator'"
                  class="inline-block size-2.5 rounded-full"
                  :class="dotClass[statusOf(ind)]"
                />
              </td>
              <td v-if="canEdit" class="text-right">
                <UButton
                  v-if="ind.level === 'indicator'"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-pen-line"
                  aria-label="Record"
                  @click="openData(ind.id)"
                />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-x"
                  aria-label="Delete"
                  @click="delIndicator(ind)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Donor portal (ME-06) -->
    <UCard>
      <template #header
        ><h3 class="text-sm font-semibold text-default">Donor / client portal</h3></template
      >
      <div v-if="localToken" class="space-y-2">
        <p class="text-sm text-muted">
          A secure read-only link is active. Anyone with it can view progress &amp; indicators.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <UInput :model-value="portalUrl" readonly size="sm" class="min-w-0 flex-1" />
          <UButton size="sm" variant="soft" icon="i-lucide-copy" label="Copy" @click="copyLink" />
          <UButton
            v-if="canEdit"
            size="sm"
            variant="ghost"
            color="error"
            label="Disable"
            @click="togglePortal(false)"
          />
        </div>
      </div>
      <div v-else class="flex items-center justify-between gap-2">
        <p class="text-sm text-muted">Share a read-only progress link with the donor or client.</p>
        <UButton
          v-if="canEdit"
          size="sm"
          icon="i-lucide-link"
          label="Enable portal"
          @click="togglePortal(true)"
        />
      </div>
    </UCard>

    <!-- Add indicator modal -->
    <UModal v-model:open="indOpen" title="Add to results framework">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Level"
            ><USelect v-model="indForm.level" :items="levelItems" value-key="value" class="w-full"
          /></UFormField>
          <UFormField label="Name" required
            ><UInput
              v-model="indForm.name"
              autofocus
              placeholder="e.g. % of farmers adopting practice"
          /></UFormField>
          <template v-if="indForm.level === 'indicator'">
            <div class="grid grid-cols-3 gap-2">
              <UFormField label="Baseline"
                ><UInputNumber v-model="indForm.baseline" class="w-full"
              /></UFormField>
              <UFormField label="Target"
                ><UInputNumber v-model="indForm.target" class="w-full"
              /></UFormField>
              <UFormField label="Unit"
                ><UInput v-model="indForm.unit" placeholder="%"
              /></UFormField>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <UFormField label="Frequency"
                ><USelect
                  v-model="indForm.frequency"
                  :items="freqItems"
                  value-key="value"
                  class="w-full"
              /></UFormField>
              <UFormField label="Data source"
                ><UInput v-model="indForm.dataSource" placeholder="Survey, MIS…"
              /></UFormField>
            </div>
          </template>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="indOpen = false"
          /><UButton label="Add" @click="addIndicator" /></div
      ></template>
    </UModal>

    <!-- Record data modal -->
    <UModal v-model:open="dataOpen" title="Record indicator data">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Indicator"
            ><USelect
              v-model="dataForm.indicatorId"
              :items="indicatorItems"
              value-key="value"
              class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Period"
              ><UInput v-model="dataForm.periodDate" type="date"
            /></UFormField>
            <UFormField label="Value" required
              ><UInputNumber v-model="dataForm.value" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Note"><UInput v-model="dataForm.note" /></UFormField>
          <UFormField label="Evidence URL"
            ><UInput v-model="dataForm.evidenceUrl" placeholder="https://…"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="dataOpen = false"
          /><UButton label="Record" @click="recordData" /></div
      ></template>
    </UModal>
  </div>
</template>
