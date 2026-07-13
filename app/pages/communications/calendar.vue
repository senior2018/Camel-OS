<script setup lang="ts">
import CommunicationsTabs from '~/components/communication/CommunicationsTabs.vue'
import {
  CONTENT_STATUS_COLOR,
  CONTENT_STATUS_LABEL,
  type ContentStatus,
} from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Content Calendar — Camel OS' })

const { can } = await usePermissions()
const canSchedule = computed(() => can.value('communications', 'update'))
if (!canSchedule.value && !can.value('communications', 'approve')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

interface Item {
  id: string
  title: string
  type: string
  status: ContentStatus
  scheduledFor: string | null
  publishedAt: string | null
  excerpt: string | null
  coverImageUrl: string | null
  platform: string | null
  publishedUrl: string | null
}

// C3 — click an item to preview it in a popup, with a link to the full page.
const preview = ref<Item | null>(null)
const previewOpen = ref(false)
function openPreview(it: Item) {
  preview.value = it
  previewOpen.value = true
}
function previewWhen(it: Item) {
  const iso = it.publishedAt ?? it.scheduledFor
  return iso
    ? new Date(iso).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const today = new Date()
const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))

const weeks = computed(() => {
  const first = cursor.value
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  const w: Date[][] = []
  for (let i = 0; i < 6; i++) w.push(days.slice(i * 7, i * 7 + 7))
  return w
})
const rangeFrom = computed(() => ymd(weeks.value[0]![0]!))
const rangeTo = computed(() => ymd(weeks.value[5]![6]!))
const monthLabel = computed(() =>
  cursor.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)

const { data, refresh } = await useFetch<{ items: Item[] }>('/api/communications/calendar', {
  key: 'calendar',
  query: { from: rangeFrom, to: rangeTo },
})

const itemsByDay = computed(() => {
  const map: Record<string, Item[]> = {}
  for (const it of data.value?.items ?? []) {
    const when = it.scheduledFor ?? it.publishedAt
    if (!when) continue
    const key = ymd(new Date(when))
    ;(map[key] ??= []).push(it)
  }
  return map
})

function prevMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1)
}
function nextMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
}
function goToday() {
  cursor.value = new Date(today.getFullYear(), today.getMonth(), 1)
}

const dotColor: Record<ContentStatus, string> = {
  draft: 'bg-neutral-400',
  in_review: 'bg-info',
  changes_requested: 'bg-warning',
  approved: 'bg-success',
  published: 'bg-primary',
  archived: 'bg-neutral-300',
}

// ── Drag to reschedule (CC-04) ──
const dragId = ref<string | null>(null)
function onDragStart(it: Item) {
  // Published items keep their real date; only unpublished items reschedule.
  if (it.status === 'published') return
  dragId.value = it.id
}
async function onDrop(dayKey: string) {
  if (!dragId.value || !canSchedule.value) return
  const itemId = dragId.value
  dragId.value = null
  try {
    await $fetch(`/api/communications/content/${itemId}`, {
      method: 'PATCH',
      body: { scheduledFor: `${dayKey}T09:00:00.000Z` },
    })
    await refresh()
  } catch {
    // ignore — refresh keeps state consistent
  }
}

const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function isToday(d: Date) {
  return ymd(d) === ymd(today)
}
function inMonth(d: Date) {
  return d.getMonth() === cursor.value.getMonth()
}
</script>

<template>
  <div class="space-y-5">
    <CommunicationsTabs class="-mt-1" />
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Content Calendar</h1>
        <p class="mt-1 text-sm text-muted">
          Scheduled and published content. Drag an item to reschedule.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          variant="outline"
          color="neutral"
          size="sm"
          aria-label="Previous"
          @click="prevMonth"
        />
        <span class="min-w-40 text-center text-sm font-semibold text-default">{{
          monthLabel
        }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          variant="outline"
          color="neutral"
          size="sm"
          aria-label="Next"
          @click="nextMonth"
        />
        <UButton label="Today" variant="ghost" color="neutral" size="sm" @click="goToday" />
      </div>
    </header>

    <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
      <div
        class="grid grid-cols-7 border-b border-default bg-elevated text-center text-xs font-medium uppercase tracking-wide text-muted"
      >
        <div v-for="d in dow" :key="d" class="py-2">{{ d }}</div>
      </div>
      <div class="grid grid-cols-7">
        <div
          v-for="day in weeks.flat()"
          :key="ymd(day)"
          class="min-h-28 border-b border-r border-default p-1.5 last:border-r-0"
          :class="inMonth(day) ? '' : 'bg-elevated/60'"
          @dragover.prevent
          @drop="onDrop(ymd(day))"
        >
          <div class="mb-1 flex items-center justify-between">
            <span
              class="flex size-6 items-center justify-center rounded-full text-xs"
              :class="
                isToday(day)
                  ? 'bg-primary font-semibold text-inverted'
                  : inMonth(day)
                    ? 'text-default'
                    : 'text-dimmed'
              "
            >
              {{ day.getDate() }}
            </span>
          </div>
          <div class="space-y-1">
            <div
              v-for="it in itemsByDay[ymd(day)] ?? []"
              :key="it.id"
              :draggable="it.status !== 'published' && canSchedule"
              class="flex cursor-pointer items-center gap-1 rounded border border-default bg-default px-1.5 py-1 text-xs transition-colors hover:border-primary/40"
              :title="`${it.title} · ${CONTENT_STATUS_LABEL[it.status]}`"
              @dragstart="onDragStart(it)"
              @click="openPreview(it)"
            >
              <span class="size-1.5 shrink-0 rounded-full" :class="dotColor[it.status]" />
              <span class="truncate text-default">{{ it.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span v-for="(c, s) in dotColor" :key="s" class="flex items-center gap-1.5">
        <span class="size-2 rounded-full" :class="c" />
        {{ CONTENT_STATUS_LABEL[s as ContentStatus] }}
      </span>
    </div>

    <!-- C3 — preview popup with a link to the full item -->
    <UModal v-model:open="previewOpen" :title="preview?.title ?? 'Preview'">
      <template #body>
        <div v-if="preview" class="space-y-3">
          <div
            v-if="preview.coverImageUrl"
            class="h-32 w-full rounded-lg bg-elevated bg-cover bg-center"
            :style="{ backgroundImage: `url(${preview.coverImageUrl})` }"
          />
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :color="CONTENT_STATUS_COLOR[preview.status]"
              variant="subtle"
              size="xs"
              :label="CONTENT_STATUS_LABEL[preview.status]"
            />
            <UBadge color="neutral" variant="outline" size="xs" :label="preview.type" />
            <UBadge
              v-if="preview.platform"
              color="primary"
              variant="subtle"
              size="xs"
              :label="preview.platform"
            />
          </div>
          <p class="text-sm text-muted">{{ previewWhen(preview) }}</p>
          <p v-if="preview.excerpt" class="text-sm text-default">{{ preview.excerpt }}</p>
          <a
            v-if="preview.publishedUrl"
            :href="preview.publishedUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <UIcon name="i-lucide-external-link" class="size-3.5" /> View live post
          </a>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Close" @click="previewOpen = false" />
          <UButton
            icon="i-lucide-arrow-right"
            trailing
            label="View full details"
            @click="navigateTo(`/communications/${preview?.id}`)"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
