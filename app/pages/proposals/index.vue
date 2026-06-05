<script setup lang="ts">
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_DESCRIPTION,
  PROPOSAL_STATUS_LABEL,
  type ProposalStatus,
} from '@@/shared/schemas/proposal'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Proposals — Camel OS' })

const { can } = await usePermissions()
if (!can.value('opportunity', 'read')) {
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

const { data, status } = await useFetch<{
  items: ProposalRow[]
  groupedByStatus: Record<ProposalStatus, ProposalRow[]>
}>('/api/proposals', {
  key: 'proposals-list',
  default: () => ({
    items: [],
    groupedByStatus: {
      writing: [],
      submitted: [],
      won: [],
      lost: [],
    } as Record<ProposalStatus, ProposalRow[]>,
  }),
})

function statusColor(s: ProposalStatus): 'primary' | 'info' | 'success' | 'error' {
  if (s === 'writing') return 'primary'
  if (s === 'submitted') return 'info'
  if (s === 'won') return 'success'
  return 'error'
}

function statusBorder(s: ProposalStatus): string {
  if (s === 'writing') return 'border-primary/40'
  if (s === 'submitted') return 'border-info/40'
  if (s === 'won') return 'border-success/40'
  return 'border-error/40'
}

function deadlineLabel(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
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
          Bids in flight — Writing → Submitted → Won / Lost. Proposals are auto-created when an
          opportunity is Accepted.
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

    <div v-else class="grid grid-cols-1 gap-4 xl:grid-cols-4 lg:grid-cols-2">
      <section
        v-for="s in PROPOSAL_STATUSES"
        :key="s"
        :class="['flex flex-col rounded-xl border bg-default/40 p-3', statusBorder(s)]"
      >
        <header class="mb-2">
          <div class="flex items-center gap-2">
            <UBadge variant="subtle" :color="statusColor(s)" size="sm">
              {{ PROPOSAL_STATUS_LABEL[s] }}
            </UBadge>
            <span class="text-xs font-medium text-muted">
              {{ data?.groupedByStatus[s]?.length ?? 0 }}
            </span>
          </div>
          <p class="mt-1 text-xs text-muted">{{ PROPOSAL_STATUS_DESCRIPTION[s] }}</p>
        </header>

        <div
          v-if="!data?.groupedByStatus[s]?.length"
          class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-default p-6 text-center text-xs text-muted"
        >
          Nothing here yet.
        </div>

        <ul v-else class="space-y-2">
          <li
            v-for="p in data.groupedByStatus[s]"
            :key="p.id"
            class="cursor-pointer rounded-lg border border-default bg-default p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow"
            @click="navigateTo(`/proposals/${p.id}`)"
          >
            <p class="line-clamp-2 text-sm font-medium text-default">{{ p.title }}</p>
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
