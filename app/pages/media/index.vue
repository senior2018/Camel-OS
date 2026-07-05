<script setup lang="ts">
import CommunicationsTabs from '~/components/communication/CommunicationsTabs.vue'
import {
  MEDIA_SENTIMENT_COLOR,
  MEDIA_SENTIMENT_LABEL,
  MEDIA_SENTIMENTS,
  MEDIA_SOURCE_TYPE_LABEL,
  MEDIA_SOURCE_TYPES,
  createMediaMentionSchema,
  type MediaSentiment,
  type MediaSourceType,
} from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Media Monitoring — Camel OS' })

const { can } = await usePermissions()
const canManage = computed(() => can.value('communications', 'update'))
if (!canManage.value && !can.value('communications', 'approve')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

interface Mention {
  id: string
  title: string
  outlet: string | null
  sourceType: MediaSourceType
  sentiment: MediaSentiment
  url: string | null
  mentionDate: string
  summary: string | null
  flagged: boolean
  escalationNote: string | null
}
interface Summary {
  total: number
  sentimentCounts: Record<MediaSentiment, number>
  topSources: { outlet: string; count: number }[]
  volume: { date: string; count: number }[]
}

const search = ref('')
const sourceType = ref<string | undefined>(undefined)
const sentiment = ref<string | undefined>(undefined)
const from = ref('')
const to = ref('')
const query = computed(() => ({
  q: search.value || undefined,
  sourceType: sourceType.value || undefined,
  sentiment: sentiment.value || undefined,
  from: from.value || undefined,
  to: to.value || undefined,
}))
const { data, refresh } = await useFetch<{ items: Mention[]; summary: Summary }>(
  '/api/communications/media-mentions',
  { query, key: 'media-mentions' }
)

const sourceItems = [
  { label: 'All sources', value: '' },
  ...MEDIA_SOURCE_TYPES.map((s) => ({ label: MEDIA_SOURCE_TYPE_LABEL[s], value: s as string })),
]
const sentimentItems = [
  { label: 'All sentiment', value: '' },
  ...MEDIA_SENTIMENTS.map((s) => ({ label: MEDIA_SENTIMENT_LABEL[s], value: s as string })),
]

const volumeSpark = computed(() => {
  const v = data.value?.summary.volume ?? []
  if (v.length < 2) return ''
  const max = Math.max(...v.map((x) => x.count), 1)
  const w = 600
  const h = 60
  return v
    .map(
      (x, i) => `${((i / (v.length - 1)) * w).toFixed(1)},${(h - (x.count / max) * h).toFixed(1)}`
    )
    .join(' ')
})

// ── Create (CC-18) ──
const toast = useToast()
const createOpen = ref(false)
const creating = ref(false)
const form = reactive({
  title: '',
  outlet: '',
  sourceType: 'online' as MediaSourceType,
  sentiment: 'neutral' as MediaSentiment,
  url: '',
  mentionDate: new Date().toISOString().slice(0, 10),
  summary: '',
})
const createSourceItems = MEDIA_SOURCE_TYPES.map((s) => ({
  label: MEDIA_SOURCE_TYPE_LABEL[s],
  value: s as string,
}))
const createSentimentItems = MEDIA_SENTIMENTS.map((s) => ({
  label: MEDIA_SENTIMENT_LABEL[s],
  value: s as string,
}))
async function create() {
  const parsed = createMediaMentionSchema.safeParse({
    title: form.title,
    outlet: form.outlet || null,
    sourceType: form.sourceType,
    sentiment: form.sentiment,
    url: form.url || '',
    mentionDate: form.mentionDate,
    summary: form.summary || null,
  })
  if (!parsed.success) {
    toast.add({ title: 'A headline and date are required', color: 'warning' })
    return
  }
  creating.value = true
  try {
    await $fetch('/api/communications/media-mentions', { method: 'POST', body: parsed.data })
    createOpen.value = false
    form.title = ''
    form.outlet = ''
    form.url = ''
    form.summary = ''
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save mention', description: msg, color: 'error' })
  } finally {
    creating.value = false
  }
}

// ── Flag (CC-21) ──
const flagOpen = ref(false)
const flagTarget = ref<Mention | null>(null)
const escalationNote = ref('')
const flagging = ref(false)
function openFlag(m: Mention) {
  flagTarget.value = m
  escalationNote.value = ''
  flagOpen.value = true
}
async function flag() {
  if (!flagTarget.value || !escalationNote.value.trim()) {
    toast.add({ title: 'An escalation note is required', color: 'warning' })
    return
  }
  flagging.value = true
  try {
    await $fetch(`/api/communications/media-mentions/${flagTarget.value.id}/flag`, {
      method: 'POST',
      body: { escalationNote: escalationNote.value.trim() },
    })
    toast.add({ title: 'Escalated to management', color: 'success' })
    flagOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Could not escalate', color: 'error' })
  } finally {
    flagging.value = false
  }
}

function fdate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
function printPage() {
  if (import.meta.client) window.print()
}
</script>

<template>
  <div class="space-y-6">
    <CommunicationsTabs class="-mt-1" />
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Media Monitoring</h1>
        <p class="mt-1 text-sm text-muted">Track coverage, sentiment, and escalate what matters.</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-printer"
          label="Export"
          @click="printPage"
        />
        <UButton
          v-if="canManage"
          icon="i-lucide-plus"
          label="Add mention"
          @click="createOpen = true"
        />
      </div>
    </header>

    <!-- Dashboard (CC-20) -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-xl border border-default bg-default shadow-sm p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Mentions</p>
        <p class="mt-1 text-2xl font-semibold text-default">{{ data?.summary.total ?? 0 }}</p>
      </div>
      <div class="rounded-xl border border-default bg-default shadow-sm p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Positive</p>
        <p class="mt-1 text-2xl font-semibold text-success">
          {{ data?.summary.sentimentCounts.positive ?? 0 }}
        </p>
      </div>
      <div class="rounded-xl border border-default bg-default shadow-sm p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Neutral</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ data?.summary.sentimentCounts.neutral ?? 0 }}
        </p>
      </div>
      <div class="rounded-xl border border-default bg-default shadow-sm p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Negative</p>
        <p class="mt-1 text-2xl font-semibold text-error">
          {{ data?.summary.sentimentCounts.negative ?? 0 }}
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <UCard class="lg:col-span-2">
        <template #header
          ><h3 class="text-sm font-semibold text-default">Mention volume</h3></template
        >
        <svg v-if="volumeSpark" viewBox="0 0 600 60" class="h-16 w-full" preserveAspectRatio="none">
          <polyline
            :points="volumeSpark"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-primary"
          />
        </svg>
        <p v-else class="py-6 text-center text-sm text-muted">Not enough data for a trend yet.</p>
      </UCard>
      <UCard>
        <template #header><h3 class="text-sm font-semibold text-default">Top sources</h3></template>
        <ul v-if="data?.summary.topSources.length" class="space-y-1.5">
          <li
            v-for="s in data.summary.topSources"
            :key="s.outlet"
            class="flex items-center justify-between text-sm"
          >
            <span class="truncate text-default">{{ s.outlet }}</span>
            <span class="text-muted">{{ s.count }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">No named sources yet.</p>
      </UCard>
    </div>

    <!-- Filters -->
    <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search mentions…"
        class="sm:max-w-xs"
      />
      <USelect
        v-model="sourceType"
        :items="sourceItems"
        value-key="value"
        placeholder="Source"
        class="sm:w-36"
      />
      <USelect
        v-model="sentiment"
        :items="sentimentItems"
        value-key="value"
        placeholder="Sentiment"
        class="sm:w-36"
      />
      <UInput v-model="from" type="date" size="sm" />
      <UInput v-model="to" type="date" size="sm" />
    </div>

    <!-- List -->
    <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Headline</th>
            <th class="hidden px-4 py-2 font-medium sm:table-cell">Source</th>
            <th class="px-4 py-2 font-medium">Sentiment</th>
            <th class="hidden px-4 py-2 font-medium md:table-cell">Date</th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="m in data?.items ?? []" :key="m.id">
            <td class="px-4 py-2.5">
              <div class="flex items-center gap-2">
                <UIcon
                  v-if="m.flagged"
                  name="i-lucide-flag"
                  class="size-3.5 text-error"
                  :title="m.escalationNote ?? 'Escalated'"
                />
                <a
                  v-if="m.url"
                  :href="m.url"
                  target="_blank"
                  rel="noopener"
                  class="font-medium text-default hover:text-primary"
                  @click.stop
                >
                  {{ m.title }}
                </a>
                <span v-else class="font-medium text-default">{{ m.title }}</span>
              </div>
              <p v-if="m.summary" class="truncate text-xs text-muted">{{ m.summary }}</p>
            </td>
            <td class="hidden px-4 py-2.5 text-muted sm:table-cell">
              {{ m.outlet || '—' }} · {{ MEDIA_SOURCE_TYPE_LABEL[m.sourceType] }}
            </td>
            <td class="px-4 py-2.5">
              <UBadge
                :color="MEDIA_SENTIMENT_COLOR[m.sentiment]"
                variant="subtle"
                size="xs"
                :label="MEDIA_SENTIMENT_LABEL[m.sentiment]"
              />
            </td>
            <td class="hidden px-4 py-2.5 text-muted md:table-cell">{{ fdate(m.mentionDate) }}</td>
            <td class="px-4 py-2.5 text-right">
              <UButton
                v-if="canManage && !m.flagged"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-flag"
                label="Escalate"
                @click="openFlag(m)"
              />
              <UBadge
                v-else-if="m.flagged"
                color="error"
                variant="subtle"
                size="xs"
                label="Escalated"
              />
            </td>
          </tr>
          <tr v-if="!data?.items.length">
            <td colspan="5" class="px-4 py-10 text-center text-sm text-muted">
              No mentions recorded yet.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create modal -->
    <UModal v-model:open="createOpen" title="Add media mention">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Headline" required>
            <UInput
              v-model="form.title"
              placeholder="e.g. Sahara Consult featured in Daily News"
              autofocus
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Outlet"
              ><UInput v-model="form.outlet" placeholder="e.g. Daily News"
            /></UFormField>
            <UFormField label="Date"><UInput v-model="form.mentionDate" type="date" /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Source type">
              <USelect
                v-model="form.sourceType"
                :items="createSourceItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Sentiment">
              <USelect
                v-model="form.sentiment"
                :items="createSentimentItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="URL"><UInput v-model="form.url" placeholder="https://…" /></UFormField>
          <UFormField label="Summary"
            ><UTextarea v-model="form.summary" :rows="2" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="createOpen = false" />
          <UButton label="Save mention" :loading="creating" @click="create" />
        </div>
      </template>
    </UModal>

    <!-- Flag modal -->
    <UModal v-model:open="flagOpen" title="Escalate to management">
      <template #body>
        <UFormField
          label="Escalation note"
          hint="Why does this need management attention?"
          required
        >
          <UTextarea v-model="escalationNote" :rows="4" class="w-full" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="flagOpen = false" />
          <UButton color="error" label="Escalate" :loading="flagging" @click="flag" />
        </div>
      </template>
    </UModal>
  </div>
</template>
