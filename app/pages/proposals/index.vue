<script setup lang="ts">
import {
  PROPOSAL_BOARD_LANES,
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_LABEL,
  laneForStatus,
  type ProposalBoardLane,
  type ProposalStatus,
} from '@@/shared/schemas/proposal'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Proposals — Camel OS' })

const { can } = await usePermissions()
if (!can.value('proposal', 'read')) {
  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have permission to view proposals.',
    fatal: true,
  })
}

interface ProposalRow {
  id: string
  opportunityId: string
  title: string
  status: ProposalStatus
  deadline: string | null
  submittedAt: string | null
  decidedAt: string | null
  reminderRecipientUserIds: string[]
  createdAt: string
  updatedAt: string
  createdByFirstName: string | null
  createdByLastName: string | null
  opportunityTitle: string
  opportunityStatus: string
}

const { data, status } = await useFetch<{ items: ProposalRow[]; total?: number; capped?: boolean }>(
  '/api/proposals',
  { key: 'proposals-list', default: () => ({ items: [], total: 0, capped: false }) }
)
const grandTotal = computed(() => data.value?.total ?? data.value?.items.length ?? 0)
const capped = computed(() => data.value?.capped ?? false)

const view = ref<'board' | 'dashboard'>('board')

// ── Search + status filter (board view) ──
const search = ref('')
const statusFilter = ref<ProposalStatus[]>([])
const statusOptions = PROPOSAL_STATUSES.map((s) => ({ label: PROPOSAL_STATUS_LABEL[s], value: s }))
const hasFilters = computed(() => search.value.trim().length > 0 || statusFilter.value.length > 0)
function clearFilters() {
  search.value = ''
  statusFilter.value = []
}

// ── PM-08: manager dashboard aggregates (always over the full set) ──
const allItems = computed(() => data.value?.items ?? [])

// Board respects the active search + status filter.
const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  const statuses = statusFilter.value
  return allItems.value.filter((p) => {
    if (statuses.length && !statuses.includes(p.status)) return false
    if (q && !`${p.title} ${p.opportunityTitle}`.toLowerCase().includes(q)) return false
    return true
  })
})
function daysTo(d: string | null): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}
const OPEN_STATUSES = new Set<ProposalStatus>([
  'assigned',
  'drafting',
  'awaiting_review',
  'revision_required',
  'ready_for_final_approval',
  'awaiting_final_approval',
  'final_approved',
])
// Dashboard analytics date range — scopes the won/lost/win-rate metrics by
// decision date. Open/submitted/at-risk stay live (current snapshot).
const dashFrom = ref('')
const dashTo = ref('')
function decidedInRange(p: ProposalRow): boolean {
  if (!p.decidedAt) return false
  const t = new Date(p.decidedAt).getTime()
  if (dashFrom.value && t < new Date(dashFrom.value).getTime()) return false
  if (dashTo.value && t > new Date(`${dashTo.value}T23:59:59`).getTime()) return false
  return true
}
const dash = computed(() => {
  const items = allItems.value
  const won = items.filter((p) => p.status === 'won' && decidedInRange(p)).length
  const lost = items.filter((p) => p.status === 'lost' && decidedInRange(p)).length
  const submitted = items.filter((p) => p.status === 'submitted').length
  const open = items.filter((p) => OPEN_STATUSES.has(p.status))
  // At-risk: open proposals with a deadline ≤7 days out or already overdue.
  const atRisk = open
    .map((p) => ({ p, d: daysTo(p.deadline) }))
    .filter((x) => x.d !== null && x.d <= 7)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
  const decided = won + lost
  return {
    total: items.length,
    open: open.length,
    submitted,
    won,
    lost,
    winRate: decided ? Math.round((won / decided) * 100) : null,
    atRisk,
  }
})
function rag(days: number | null): 'error' | 'warning' | 'neutral' {
  if (days === null) return 'neutral'
  if (days < 0) return 'error'
  if (days <= 7) return 'warning'
  return 'neutral'
}

// Group proposals into the six readable board lanes (the raw statuses are too
// many for columns). Honours the active filter.
const byLane = computed<Record<string, ProposalRow[]>>(() => {
  const map: Record<string, ProposalRow[]> = Object.fromEntries(
    PROPOSAL_BOARD_LANES.map((l) => [l.key, [] as ProposalRow[]])
  )
  for (const p of filteredItems.value) map[laneForStatus(p.status).key]!.push(p)
  return map
})

// When filtering/searching, drop empty lanes so the board isn't a wall of
// "0" columns; with no filter active, keep all lanes for the full overview.
const visibleLanes = computed(() =>
  hasFilters.value
    ? PROPOSAL_BOARD_LANES.filter((l) => (byLane.value[l.key]?.length ?? 0) > 0)
    : PROPOSAL_BOARD_LANES
)

// Per-lane "show more" — cap each column, reveal another batch on demand.
const LANE_PAGE = 4
const laneShown = reactive<Record<string, number>>({})
function laneVisibleCount(key: string): number {
  return laneShown[key] ?? LANE_PAGE
}
function laneVisible(key: string): ProposalRow[] {
  return (byLane.value[key] ?? []).slice(0, laneVisibleCount(key))
}
function laneShowMore(key: string) {
  laneShown[key] = laneVisibleCount(key) + LANE_PAGE
}
function laneShowLess(key: string) {
  laneShown[key] = LANE_PAGE
}

function laneAccent(lane: ProposalBoardLane): string {
  const map: Record<string, string> = {
    in_progress: 'border-primary/40',
    in_review: 'border-info/40',
    approval: 'border-info/40',
    ready: 'border-success/40',
    outcome: 'border-success/40',
    closed: 'border-error/40',
  }
  return map[lane.key] ?? 'border-default'
}

function deadlineLabel(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
}

function deadlineColor(d: string | null): 'error' | 'warning' | 'neutral' {
  if (!d) return 'neutral'
  const days = (new Date(d).getTime() - Date.now()) / 86_400_000
  if (days < 0) return 'error'
  if (days <= 7) return 'warning'
  return 'neutral'
}

const totalCount = computed(() => data.value?.items.length ?? 0)
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Proposals</h1>
        <p class="mt-1 text-sm text-muted">
          Bids in flight — assign a team, draft, align reviewers, get final sign-off, then submit.
          Proposals are created automatically when an opportunity is Accepted.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UFieldGroup>
          <UButton
            :color="view === 'board' ? 'primary' : 'neutral'"
            :variant="view === 'board' ? 'solid' : 'outline'"
            icon="i-lucide-columns-3"
            label="Board"
            @click="view = 'board'"
          />
          <UButton
            :color="view === 'dashboard' ? 'primary' : 'neutral'"
            :variant="view === 'dashboard' ? 'solid' : 'outline'"
            icon="i-lucide-bar-chart-3"
            label="Dashboard"
            @click="view = 'dashboard'"
          />
        </UFieldGroup>
        <UBadge variant="subtle" color="neutral" size="md">{{ grandTotal }} total</UBadge>
      </div>
    </header>

    <UAlert
      v-if="capped"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Showing the most recent 500"
      :description="`This view is capped for performance (${grandTotal} total). Use search, or the Win/Loss report, to reach the full archive.`"
    />

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <div
      v-else-if="totalCount === 0"
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-file-text" class="size-10 text-muted" />
      <h2 class="text-lg font-semibold text-default">No proposals yet</h2>
      <p class="max-w-md text-sm text-muted">
        When you Accept an opportunity, a proposal is created here automatically.
      </p>
      <UButton
        variant="outline"
        label="Go to Opportunities"
        @click="navigateTo('/opportunities')"
      />
    </div>

    <!-- PM-08 — manager dashboard -->
    <div v-else-if="view === 'dashboard'" class="space-y-6">
      <div class="flex flex-wrap items-end justify-end gap-2">
        <UFormField label="Decided from" size="xs">
          <UInput v-model="dashFrom" type="date" size="sm" />
        </UFormField>
        <UFormField label="To" size="xs">
          <UInput v-model="dashTo" type="date" size="sm" />
        </UFormField>
        <UButton
          v-if="dashFrom || dashTo"
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-x"
          label="Clear"
          @click="((dashFrom = ''), (dashTo = ''))"
        />
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-bar-chart-2"
          label="Win / Loss report"
          class="sm:ml-auto"
          @click="navigateTo('/reports/win-loss')"
        />
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Open</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ dash.open }}</p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Submitted</p>
          <p class="mt-1 text-2xl font-semibold text-info">{{ dash.submitted }}</p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Won</p>
          <p class="mt-1 text-2xl font-semibold text-success">{{ dash.won }}</p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Lost</p>
          <p class="mt-1 text-2xl font-semibold text-error">{{ dash.lost }}</p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Win rate</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ dash.winRate === null ? '—' : `${dash.winRate}%` }}
          </p>
        </div>
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-default">At-risk (deadline ≤ 7 days)</h3>
            <UBadge :color="dash.atRisk.length ? 'warning' : 'neutral'" variant="subtle" size="sm">
              {{ dash.atRisk.length }}
            </UBadge>
          </div>
        </template>
        <div v-if="!dash.atRisk.length" class="py-4 text-center text-sm text-muted">
          Nothing at risk — all open proposals have breathing room.
        </div>
        <ul v-else class="divide-y divide-default">
          <li
            v-for="{ p, d } in dash.atRisk"
            :key="p.id"
            class="flex cursor-pointer items-center justify-between gap-3 py-2 hover:bg-elevated/40"
            @click="navigateTo(`/proposals/${p.id}`)"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-default">{{ p.title }}</p>
              <p class="truncate text-xs text-muted">{{ p.opportunityTitle }}</p>
            </div>
            <UBadge :color="rag(d)" variant="subtle" size="xs">
              {{ d !== null && d < 0 ? `${-d}d overdue` : `${d}d left` }}
            </UBadge>
          </li>
        </ul>
      </UCard>
    </div>

    <div v-else class="space-y-4">
      <!-- Search + status filter -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by title or opportunity…"
          class="sm:max-w-xs"
        />
        <USelectMenu
          v-model="statusFilter"
          :items="statusOptions"
          value-key="value"
          multiple
          placeholder="Any status"
          icon="i-lucide-filter"
          class="sm:w-60"
        />
        <UButton
          v-if="hasFilters"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          label="Clear"
          size="sm"
          @click="clearFilters"
        />
        <span class="text-xs text-muted sm:ml-auto">{{ filteredItems.length }} shown</span>
      </div>

      <div
        v-if="!filteredItems.length"
        class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-default p-10 text-center"
      >
        <UIcon name="i-lucide-filter-x" class="size-8 text-muted" />
        <p class="text-sm text-muted">No proposals match your filters.</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section
          v-for="lane in visibleLanes"
          :key="lane.key"
          :class="['flex flex-col rounded-xl border bg-default/40 p-3', laneAccent(lane)]"
        >
          <header class="mb-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-default">{{ lane.label }}</span>
              <span class="text-xs font-medium text-muted">{{
                byLane[lane.key]?.length ?? 0
              }}</span>
            </div>
            <p class="mt-0.5 text-xs text-muted">{{ lane.description }}</p>
          </header>

          <div
            v-if="!byLane[lane.key]?.length"
            class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-default p-6 text-center text-xs text-muted"
          >
            Nothing here yet.
          </div>

          <ul v-else class="space-y-2">
            <li
              v-for="p in laneVisible(lane.key)"
              :key="p.id"
              class="cursor-pointer rounded-lg border border-default bg-default p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow"
              @click="navigateTo(`/proposals/${p.id}`)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="line-clamp-2 text-sm font-medium text-default">{{ p.title }}</p>
                <UBadge
                  :color="PROPOSAL_STATUS_COLOR[p.status]"
                  variant="subtle"
                  size="xs"
                  :label="PROPOSAL_STATUS_LABEL[p.status]"
                />
              </div>
              <p class="mt-1 truncate text-xs text-muted">
                <UIcon name="i-lucide-target" class="mr-1 inline size-3" />
                {{ p.opportunityTitle }}
              </p>
              <div class="mt-2 flex items-center justify-between text-xs">
                <UBadge
                  v-if="p.deadline"
                  variant="subtle"
                  :color="deadlineColor(p.deadline)"
                  size="xs"
                  :label="deadlineLabel(p.deadline)"
                />
                <span v-else class="text-dimmed">No deadline</span>
                <span v-if="p.reminderRecipientUserIds.length" class="text-muted">
                  <UIcon name="i-lucide-users" class="inline size-3" />
                  {{ p.reminderRecipientUserIds.length }}
                </span>
              </div>
            </li>
          </ul>

          <div
            v-if="(byLane[lane.key]?.length ?? 0) > LANE_PAGE"
            class="mt-2 flex items-center justify-center gap-2"
          >
            <UButton
              v-if="laneVisibleCount(lane.key) < (byLane[lane.key]?.length ?? 0)"
              size="xs"
              variant="ghost"
              color="neutral"
              :label="`Show more (${(byLane[lane.key]?.length ?? 0) - laneVisibleCount(lane.key)})`"
              icon="i-lucide-chevron-down"
              @click="laneShowMore(lane.key)"
            />
            <UButton
              v-if="laneVisibleCount(lane.key) > LANE_PAGE"
              size="xs"
              variant="ghost"
              color="neutral"
              label="Show less"
              icon="i-lucide-chevron-up"
              @click="laneShowLess(lane.key)"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
