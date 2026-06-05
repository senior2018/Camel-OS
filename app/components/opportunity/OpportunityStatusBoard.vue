<script setup lang="ts">
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_DESCRIPTION,
  OPPORTUNITY_STATUS_LABEL,
  type OpportunityStatus,
} from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

/**
 * S7 — Three-column board showing opportunities grouped by review status:
 * Pending / Accepted / Rejected. Click a card to open the form modal; status
 * changes flow through the modal's status buttons (which captures the
 * required comment + auto-creates a Proposal when Accepting).
 */
interface Props {
  grouped: Record<OpportunityStatus, Opportunity[]>
}

defineProps<Props>()
const emit = defineEmits<{
  selectOpportunity: [opp: Opportunity]
}>()

function statusColor(s: OpportunityStatus): 'warning' | 'success' | 'error' {
  return s === 'pending' ? 'warning' : s === 'accepted' ? 'success' : 'error'
}

function statusBorder(s: OpportunityStatus): string {
  return s === 'pending'
    ? 'border-warning/40'
    : s === 'accepted'
      ? 'border-success/40'
      : 'border-error/40'
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <section
      v-for="s in OPPORTUNITY_STATUSES"
      :key="s"
      :class="['flex flex-col rounded-xl border bg-default/40 p-3', statusBorder(s)]"
    >
      <header class="mb-2 flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <UBadge variant="subtle" :color="statusColor(s)" size="sm">
              {{ OPPORTUNITY_STATUS_LABEL[s] }}
            </UBadge>
            <span class="text-xs font-medium text-muted">{{ grouped[s].length }}</span>
          </div>
          <p class="mt-1 text-xs text-muted">{{ OPPORTUNITY_STATUS_DESCRIPTION[s] }}</p>
        </div>
      </header>

      <div
        v-if="!grouped[s].length"
        class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-default p-6 text-center text-xs text-muted"
      >
        Nothing here yet.
      </div>

      <ul v-else class="space-y-2">
        <li v-for="opp in grouped[s]" :key="opp.id" @click="emit('selectOpportunity', opp)">
          <OpportunityCard :opportunity="opp" />
        </li>
      </ul>
    </section>
  </div>
</template>
