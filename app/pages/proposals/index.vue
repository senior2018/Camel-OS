<script setup lang="ts">
import {
  PROPOSAL_BOARD_LANES,
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

const { data, status } = await useFetch<{ items: ProposalRow[] }>('/api/proposals', {
  key: 'proposals-list',
  default: () => ({ items: [] }),
})

// Group proposals into the six readable board lanes (the 13 raw statuses are
// too many for columns).
const byLane = computed<Record<string, ProposalRow[]>>(() => {
  const map: Record<string, ProposalRow[]> = Object.fromEntries(
    PROPOSAL_BOARD_LANES.map((l) => [l.key, [] as ProposalRow[]])
  )
  for (const p of data.value?.items ?? []) map[laneForStatus(p.status).key]!.push(p)
  return map
})

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
      <UBadge variant="subtle" color="neutral" size="md">{{ totalCount }} total</UBadge>
    </header>

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

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <section
        v-for="lane in PROPOSAL_BOARD_LANES"
        :key="lane.key"
        :class="['flex flex-col rounded-xl border bg-default/40 p-3', laneAccent(lane)]"
      >
        <header class="mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-default">{{ lane.label }}</span>
            <span class="text-xs font-medium text-muted">{{ byLane[lane.key]?.length ?? 0 }}</span>
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
            v-for="p in byLane[lane.key]"
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
      </section>
    </div>
  </div>
</template>
