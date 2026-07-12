<script setup lang="ts">
import {
  FEEDBACK_CATEGORY_ICON,
  FEEDBACK_STATUS_COLOR,
  FEEDBACK_STATUSES,
  UAT_STATUS_COLOR,
  UAT_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
  type UatStatus,
} from '@@/shared/schemas/launch'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Launch Cockpit — Camel OS' })

const { can, isAdmin } = await usePermissions()
if (!isAdmin.value && !can.value('admin', 'admin')) {
  throw createError({ statusCode: 403, statusMessage: 'Admin only', fatal: true })
}
const tab = ref<'readiness' | 'uat' | 'feedback'>('readiness')

const { data: ready, refresh: refreshReady } = await useFetch<{
  readiness: number
  uat: { total: number; pass: number; fail: number; blocked: number }
  tasks: { total: number; done: number }
  openFeedback: number
}>('/api/launch/readiness', {
  key: 'launch-readiness',
  default: () => ({
    readiness: 0,
    uat: { total: 0, pass: 0, fail: 0, blocked: 0 },
    tasks: { total: 0, done: 0 },
    openFeedback: 0,
  }),
})

const { data: tasks, refresh: refreshTasks } = await useFetch<{
  items: { id: string; category: string; label: string; done: boolean }[]
}>('/api/launch/tasks', { key: 'launch-tasks', default: () => ({ items: [] }) })
const tasksByCat = computed(() => {
  const g: Record<string, { id: string; label: string; done: boolean }[]> = {}
  for (const t of tasks.value?.items ?? []) (g[t.category] ??= []).push(t)
  return g
})
async function toggleTask(t: { id: string; done: boolean }) {
  await $fetch(`/api/launch/tasks/${t.id}`, { method: 'PATCH', body: { done: !t.done } }).catch(
    () => {}
  )
  await Promise.all([refreshTasks(), refreshReady()])
}

const { data: uat, refresh: refreshUat } = await useFetch<{
  items: {
    id: string
    module: string
    storyCode: string | null
    title: string
    status: UatStatus
    notes: string | null
    testerFirst: string | null
    testerLast: string | null
  }[]
}>('/api/launch/uat', { key: 'launch-uat', default: () => ({ items: [] }) })
const uatItems = UAT_STATUSES.map((s) => ({ label: s, value: s }))
async function setUat(row: { id: string }, status: UatStatus) {
  await $fetch(`/api/launch/uat/${row.id}`, { method: 'PATCH', body: { status } }).catch(() => {})
  await Promise.all([refreshUat(), refreshReady()])
}

const { data: feedback, refresh: refreshFb } = await useFetch<{
  items: {
    id: string
    category: FeedbackCategory
    message: string
    pageUrl: string | null
    status: FeedbackStatus
    first: string | null
    last: string | null
    createdAt: string
  }[]
}>('/api/launch/feedback', { key: 'launch-feedback', default: () => ({ items: [] }) })
const fbItems = FEEDBACK_STATUSES.map((s) => ({ label: s.replace('_', ' '), value: s }))
async function setFb(row: { id: string }, status: FeedbackStatus) {
  await $fetch(`/api/launch/feedback/${row.id}`, { method: 'PATCH', body: { status } }).catch(
    () => {}
  )
  await Promise.all([refreshFb(), refreshReady()])
}
const uname = (f: string | null, l: string | null) =>
  [f, l].filter(Boolean).join(' ') || 'Anonymous'
const when = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const readyColor = computed(() =>
  ready.value!.readiness >= 90
    ? 'text-success'
    : ready.value!.readiness >= 60
      ? 'text-warning'
      : 'text-error'
)
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Launch Cockpit</h1>
        <p class="mt-1 text-sm text-muted">
          Go-live readiness, UAT sign-off, and pilot feedback — the single view for shipping v1.0.
        </p>
      </div>
    </header>

    <div class="flex gap-1 border-b border-default">
      <button
        v-for="t in ['readiness', 'uat', 'feedback'] as const"
        :key="t"
        class="border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors"
        :class="
          tab === t
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-default'
        "
        @click="tab = t"
      >
        {{ t }}
      </button>
    </div>

    <!-- READINESS -->
    <div v-show="tab === 'readiness'" class="space-y-5">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <UCard class="lg:col-span-1">
          <div class="flex flex-col items-center py-2 text-center">
            <p class="text-xs uppercase tracking-wide text-muted">Go-live readiness</p>
            <p class="mt-1 text-5xl font-bold tracking-tight" :class="readyColor">
              {{ ready?.readiness }}%
            </p>
            <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full"
                :class="
                  ready!.readiness >= 90
                    ? 'bg-success'
                    : ready!.readiness >= 60
                      ? 'bg-warning'
                      : 'bg-error'
                "
                :style="{ width: `${ready?.readiness}%` }"
              />
            </div>
          </div>
        </UCard>
        <div class="grid grid-cols-3 gap-4 lg:col-span-3">
          <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wide text-muted">UAT passed</p>
            <p class="mt-1 text-2xl font-semibold text-default">
              {{ ready?.uat.pass }}/{{ ready?.uat.total }}
            </p>
            <p class="text-xs text-error">{{ ready?.uat.fail }} failing</p>
          </div>
          <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wide text-muted">Checklist done</p>
            <p class="mt-1 text-2xl font-semibold text-default">
              {{ ready?.tasks.done }}/{{ ready?.tasks.total }}
            </p>
          </div>
          <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wide text-muted">Open feedback</p>
            <p class="mt-1 text-2xl font-semibold text-default">{{ ready?.openFeedback }}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UCard v-for="(list, cat) in tasksByCat" :key="cat">
          <template #header
            ><h3 class="text-sm font-semibold text-default">{{ cat }}</h3></template
          >
          <ul class="space-y-2">
            <li v-for="t in list" :key="t.id">
              <label class="flex cursor-pointer items-start gap-2 text-sm">
                <UCheckbox :model-value="t.done" @update:model-value="toggleTask(t)" />
                <span :class="t.done ? 'text-muted line-through' : 'text-default'">{{
                  t.label
                }}</span>
              </label>
            </li>
          </ul>
        </UCard>
      </div>
    </div>

    <!-- UAT -->
    <div v-show="tab === 'uat'" class="space-y-3">
      <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Module / Case</th>
              <th class="hidden px-4 py-2 font-medium md:table-cell">Tester</th>
              <th class="px-4 py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="c in uat?.items ?? []" :key="c.id">
              <td class="px-4 py-2.5">
                <p class="font-medium text-default">{{ c.title }}</p>
                <p class="text-xs text-muted">
                  {{ c.module }}<span v-if="c.storyCode"> · {{ c.storyCode }}</span>
                </p>
              </td>
              <td class="hidden px-4 py-2.5 text-muted md:table-cell">
                {{ uname(c.testerFirst, c.testerLast) }}
              </td>
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-2">
                  <UBadge
                    :color="UAT_STATUS_COLOR[c.status]"
                    variant="subtle"
                    size="xs"
                    :label="c.status"
                  />
                  <USelect
                    :model-value="c.status"
                    :items="uatItems"
                    value-key="value"
                    size="xs"
                    class="w-28"
                    @update:model-value="(v: UatStatus) => setUat(c, v)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FEEDBACK -->
    <div v-show="tab === 'feedback'" class="space-y-3">
      <div
        v-if="!(feedback?.items ?? []).length"
        class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
      >
        No pilot feedback yet.
      </div>
      <UCard v-for="f in feedback?.items ?? []" :key="f.id">
        <div class="flex items-start gap-3">
          <UIcon
            :name="FEEDBACK_CATEGORY_ICON[f.category]"
            class="mt-0.5 size-5 shrink-0 text-primary"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm text-default">{{ f.message }}</p>
            <p class="mt-1 text-xs text-muted">
              {{ uname(f.first, f.last) }} · {{ when(f.createdAt)
              }}<span v-if="f.pageUrl"> · {{ f.pageUrl }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UBadge
              :color="FEEDBACK_STATUS_COLOR[f.status]"
              variant="subtle"
              size="xs"
              :label="f.status.replace('_', ' ')"
            />
            <USelect
              :model-value="f.status"
              :items="fbItems"
              value-key="value"
              size="xs"
              class="w-32"
              @update:model-value="(v: FeedbackStatus) => setFb(f, v)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
