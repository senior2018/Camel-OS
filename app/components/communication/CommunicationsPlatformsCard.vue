<script setup lang="ts">
import {
  DEFAULT_COMMUNICATIONS_SETTINGS,
  type CommunicationsSettings,
} from '@@/shared/schemas/communication-settings'

defineProps<{ canManage: boolean }>()
const toast = useToast()

const { data, refresh } = await useFetch<{ settings: CommunicationsSettings }>(
  '/api/communications/settings/platforms',
  {
    key: 'comms-platforms-admin',
    default: () => ({ settings: { ...DEFAULT_COMMUNICATIONS_SETTINGS } }),
  }
)

const platforms = ref<string[]>([])
const metrics = ref<Record<string, string[]>>({})
watchEffect(() => {
  const s = data.value?.settings
  if (s) {
    platforms.value = [...s.platforms]
    const next: Record<string, string[]> = {}
    for (const p of s.platforms) next[p] = [...(s.platformMetrics[p] ?? [])]
    metrics.value = next
  }
})

const newPlatform = ref('')
function addPlatform() {
  const v = newPlatform.value.trim()
  if (!v || platforms.value.some((p) => p.toLowerCase() === v.toLowerCase())) return
  platforms.value.push(v)
  metrics.value = { ...metrics.value, [v]: [] }
  newPlatform.value = ''
}
function removePlatform(p: string) {
  platforms.value = platforms.value.filter((x) => x !== p)
  const { [p]: _removed, ...rest } = metrics.value
  metrics.value = rest
}
const metricDrafts = reactive<Record<string, string>>({})
function addMetric(p: string) {
  const v = (metricDrafts[p] ?? '').trim()
  if (!v) return
  const list = metrics.value[p] ?? []
  if (!list.some((m) => m.toLowerCase() === v.toLowerCase()))
    metrics.value = { ...metrics.value, [p]: [...list, v] }
  metricDrafts[p] = ''
}
function removeMetric(p: string, i: number) {
  metrics.value[p]?.splice(i, 1)
}

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    const platformMetrics: Record<string, string[]> = {}
    for (const p of platforms.value) platformMetrics[p] = metrics.value[p] ?? []
    await $fetch('/api/communications/settings/platforms', {
      method: 'PUT',
      body: { platforms: platforms.value, platformMetrics },
    })
    toast.add({ title: 'Platforms saved', color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({
      title: 'Could not save',
      description: (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-default">Social platforms &amp; metrics</h3>
          <p class="mt-0.5 text-xs text-muted">
            The platforms posts can be published to, and the performance metrics captured for each —
            the campaign entry form adapts to these. Nothing is hard-coded.
          </p>
        </div>
        <UButton v-if="canManage" size="sm" label="Save" :loading="saving" @click="save" />
      </div>
    </template>

    <div class="space-y-4">
      <div
        v-for="p in platforms"
        :key="p"
        class="rounded-lg border border-default bg-default p-3 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-default">{{ p }}</span>
          <UButton
            v-if="canManage"
            size="xs"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            aria-label="Remove platform"
            @click="removePlatform(p)"
          />
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <UBadge
            v-for="(m, i) in metrics[p] ?? []"
            :key="m"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ m }}
            <button
              v-if="canManage"
              class="ml-1 text-muted hover:text-error"
              @click="removeMetric(p, i)"
            >
              ×
            </button>
          </UBadge>
          <span v-if="!(metrics[p] ?? []).length" class="text-xs text-muted">No metrics yet.</span>
        </div>
        <div v-if="canManage" class="mt-2 flex gap-2">
          <UInput
            v-model="metricDrafts[p]"
            placeholder="e.g. Reach"
            size="xs"
            class="w-40"
            @keydown.enter.prevent="addMetric(p)"
          />
          <UButton
            size="xs"
            variant="soft"
            icon="i-lucide-plus"
            label="Metric"
            @click="addMetric(p)"
          />
        </div>
      </div>

      <div v-if="canManage" class="flex gap-2">
        <UInput
          v-model="newPlatform"
          placeholder="Add a platform (e.g. TikTok)"
          size="sm"
          class="flex-1"
          @keydown.enter.prevent="addPlatform"
        />
        <UButton size="sm" variant="soft" icon="i-lucide-plus" label="Add" @click="addPlatform" />
      </div>
    </div>
  </UCard>
</template>
