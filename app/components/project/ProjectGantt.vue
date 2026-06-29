<script setup lang="ts">
import { ACTIVITY_STATUS_LABEL, type ActivityStatus } from '@@/shared/schemas/project'

interface Activity {
  id: string
  name: string
  milestoneId: string | null
  startDate: string | null
  endDate: string | null
  percentComplete: number
  status: ActivityStatus
  assigneeFirstName: string | null
  assigneeLastName: string | null
}
interface Milestone {
  id: string
  name: string
  dueDate: string | null
  status: string
}

const props = defineProps<{
  milestones: Milestone[]
  activities: Activity[]
  projectStart: string | null
  projectEnd: string | null
}>()

function d(s: string | null) {
  return s ? new Date(`${s}T00:00:00`) : null
}
const range = computed(() => {
  const dates: number[] = []
  for (const a of props.activities) {
    if (a.startDate) dates.push(d(a.startDate)!.getTime())
    if (a.endDate) dates.push(d(a.endDate)!.getTime())
  }
  for (const m of props.milestones) if (m.dueDate) dates.push(d(m.dueDate)!.getTime())
  if (props.projectStart) dates.push(d(props.projectStart)!.getTime())
  if (props.projectEnd) dates.push(d(props.projectEnd)!.getTime())
  if (!dates.length) {
    const now = Date.now()
    return { min: now, max: now + 30 * 86_400_000 }
  }
  const min = Math.min(...dates)
  let max = Math.max(...dates)
  if (min === max) max = min + 7 * 86_400_000
  const pad = (max - min) * 0.05
  return { min: min - pad, max: max + pad }
})
function pct(ts: number) {
  return ((ts - range.value.min) / (range.value.max - range.value.min)) * 100
}
function barStyle(a: Activity) {
  const s = a.startDate ? d(a.startDate)!.getTime() : range.value.min
  const e = a.endDate ? d(a.endDate)!.getTime() : s + 3 * 86_400_000
  const left = pct(s)
  const width = Math.max(2, pct(e) - left)
  return { left: `${left}%`, width: `${width}%` }
}
const todayPct = computed(() => {
  const p = pct(Date.now())
  return p >= 0 && p <= 100 ? p : null
})
const ticks = computed(() => {
  const out: { label: string; left: number }[] = []
  const cur = new Date(range.value.min)
  cur.setDate(1)
  const end = new Date(range.value.max)
  while (cur <= end) {
    const p = pct(cur.getTime())
    if (p >= 0 && p <= 100)
      out.push({ label: cur.toLocaleDateString(undefined, { month: 'short' }), left: p })
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
})
const barColor: Record<ActivityStatus, string> = {
  todo: 'bg-neutral-300 dark:bg-neutral-600',
  in_progress: 'bg-info',
  blocked: 'bg-error',
  done: 'bg-success',
}
const rows = computed(() => {
  const groups = props.milestones.map((m) => ({
    milestone: m,
    items: props.activities.filter((a) => a.milestoneId === m.id),
  }))
  const unassigned = props.activities.filter((a) => !a.milestoneId)
  if (unassigned.length)
    groups.push({
      milestone: { id: 'none', name: 'Unscheduled', dueDate: null, status: 'not_started' },
      items: unassigned,
    })
  return groups.filter((g) => g.items.length || g.milestone.id !== 'none')
})
function mDueLeft(m: Milestone) {
  return m.dueDate ? pct(d(m.dueDate)!.getTime()) : null
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="min-w-[640px]">
      <!-- Axis -->
      <div class="flex">
        <div class="w-48 shrink-0" />
        <div class="relative h-6 flex-1 border-b border-default">
          <span
            v-for="t in ticks"
            :key="t.label + t.left"
            class="absolute top-0 -translate-x-1/2 text-xs text-muted"
            :style="{ left: `${t.left}%` }"
          >
            {{ t.label }}
          </span>
        </div>
      </div>

      <div
        v-if="!activities.length && !milestones.length"
        class="py-8 text-center text-sm text-muted"
      >
        Add milestones and activities to see the timeline.
      </div>

      <div v-for="g in rows" :key="g.milestone.id" class="border-b border-default/60">
        <!-- Milestone header row with due diamond -->
        <div class="flex items-center">
          <div class="w-48 shrink-0 truncate py-2 pr-2 text-sm font-semibold text-default">
            {{ g.milestone.name }}
          </div>
          <div class="relative h-9 flex-1">
            <span
              v-if="todayPct !== null"
              class="absolute inset-y-0 z-10 w-px bg-primary/50"
              :style="{ left: `${todayPct}%` }"
            />
            <span
              v-if="mDueLeft(g.milestone) !== null"
              class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-default bg-warning"
              :style="{ left: `${mDueLeft(g.milestone)}%` }"
              :title="`Due ${g.milestone.dueDate}`"
            />
          </div>
        </div>
        <!-- Activity rows -->
        <div v-for="a in g.items" :key="a.id" class="flex items-center">
          <div class="w-48 shrink-0 truncate py-1.5 pr-2 pl-3 text-xs text-muted">{{ a.name }}</div>
          <div class="relative h-7 flex-1">
            <span
              v-if="todayPct !== null"
              class="absolute inset-y-0 w-px bg-primary/30"
              :style="{ left: `${todayPct}%` }"
            />
            <div
              class="absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded"
              :class="barColor[a.status]"
              :style="barStyle(a)"
              :title="`${a.name} · ${ACTIVITY_STATUS_LABEL[a.status]} · ${a.percentComplete}%`"
            >
              <div class="h-full bg-black/20" :style="{ width: `${a.percentComplete}%` }" />
            </div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span class="flex items-center gap-1.5"
          ><span class="size-2.5 rotate-45 bg-warning" /> Milestone due</span
        >
        <span v-for="(c, s) in barColor" :key="s" class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm" :class="c" />
          {{ ACTIVITY_STATUS_LABEL[s as ActivityStatus] }}
        </span>
        <span class="flex items-center gap-1.5"><span class="h-3 w-px bg-primary/60" /> Today</span>
      </div>
    </div>
  </div>
</template>
