<script setup lang="ts">
const props = defineProps<{ contentId: string; canEdit: boolean }>()

interface Metric {
  id: string
  metricDate: string
  impressions: number
  clicks: number
  shares: number
  likes: number
}
interface Totals {
  impressions: number
  clicks: number
  shares: number
  likes: number
  engagement: number
}

const { data, refresh } = useFetch<{ metrics: Metric[]; totals: Totals }>(
  `/api/communications/content/${props.contentId}/metrics`,
  {
    key: `metrics-${props.contentId}`,
    default: () => ({
      metrics: [],
      totals: { impressions: 0, clicks: 0, shares: 0, likes: 0, engagement: 0 },
    }),
  }
)

const toast = useToast()
const open = ref(false)
const form = reactive({
  metricDate: new Date().toISOString().slice(0, 10),
  impressions: 0,
  clicks: 0,
  shares: 0,
  likes: 0,
})
const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch(`/api/communications/content/${props.contentId}/metrics`, {
      method: 'PUT',
      body: { ...form },
    })
    open.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Could not save metrics', color: 'error' })
  } finally {
    saving.value = false
  }
}

function engagement(m: Metric) {
  return m.clicks + m.shares + m.likes
}
const metrics = computed(() => data.value?.metrics ?? [])
const spark = computed(() => {
  const ms = metrics.value
  if (ms.length < 2) return ''
  const vals = ms.map(engagement)
  const max = Math.max(...vals, 1)
  const w = 240
  const h = 44
  return ms
    .map(
      (m, i) =>
        `${((i / (ms.length - 1)) * w).toFixed(1)},${(h - (engagement(m) / max) * h).toFixed(1)}`
    )
    .join(' ')
})
function fdate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function exportCsv() {
  const rows = [
    ['Date', 'Impressions', 'Clicks', 'Shares', 'Likes', 'Engagement'],
    ...metrics.value.map((m) => [
      m.metricDate,
      m.impressions,
      m.clicks,
      m.shares,
      m.likes,
      engagement(m),
    ]),
  ]
  const csv = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'content-metrics.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Engagement metrics</h3>
        <div class="flex items-center gap-1">
          <UButton
            v-if="metrics.length"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-download"
            label="CSV"
            @click="exportCsv"
          />
          <UButton
            v-if="canEdit"
            size="xs"
            variant="soft"
            icon="i-lucide-plus"
            label="Add"
            @click="open = !open"
          />
        </div>
      </div>
    </template>

    <div class="space-y-3">
      <!-- Totals -->
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg border border-default p-2">
          <p class="text-xs text-muted">Impressions</p>
          <p class="text-lg font-semibold text-default">{{ data?.totals.impressions ?? 0 }}</p>
        </div>
        <div class="rounded-lg border border-default p-2">
          <p class="text-xs text-muted">Engagement</p>
          <p class="text-lg font-semibold text-primary">{{ data?.totals.engagement ?? 0 }}</p>
        </div>
        <div class="rounded-lg border border-default p-2">
          <p class="text-xs text-muted">Shares</p>
          <p class="text-lg font-semibold text-default">{{ data?.totals.shares ?? 0 }}</p>
        </div>
      </div>

      <!-- Trend sparkline -->
      <svg v-if="spark" viewBox="0 0 240 44" class="h-12 w-full" preserveAspectRatio="none">
        <polyline
          :points="spark"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="text-primary"
        />
      </svg>

      <!-- Add form -->
      <div
        v-if="open && canEdit"
        class="space-y-2 rounded-lg border border-default bg-elevated/30 p-2"
      >
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Date" size="xs">
            <UInput v-model="form.metricDate" type="date" size="sm" />
          </UFormField>
          <UFormField label="Impressions" size="xs">
            <UInputNumber v-model="form.impressions" :min="0" size="sm" />
          </UFormField>
          <UFormField label="Clicks" size="xs">
            <UInputNumber v-model="form.clicks" :min="0" size="sm" />
          </UFormField>
          <UFormField label="Shares" size="xs">
            <UInputNumber v-model="form.shares" :min="0" size="sm" />
          </UFormField>
          <UFormField label="Likes" size="xs">
            <UInputNumber v-model="form.likes" :min="0" size="sm" />
          </UFormField>
        </div>
        <div class="flex justify-end">
          <UButton size="xs" label="Save" :loading="saving" @click="save" />
        </div>
      </div>

      <!-- Table -->
      <table v-if="metrics.length" class="w-full text-xs">
        <thead class="text-left text-muted">
          <tr>
            <th class="py-1 font-medium">Date</th>
            <th class="py-1 text-right font-medium">Impr.</th>
            <th class="py-1 text-right font-medium">Eng.</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="m in metrics" :key="m.id">
            <td class="py-1 text-default">{{ fdate(m.metricDate) }}</td>
            <td class="py-1 text-right text-muted">{{ m.impressions }}</td>
            <td class="py-1 text-right text-default">{{ engagement(m) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="text-center text-xs text-muted">No metrics recorded yet.</p>
    </div>
  </UCard>
</template>
