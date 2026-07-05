<script setup lang="ts">
import {
  OPPORTUNITY_SOURCE_LABEL,
  OPPORTUNITY_STATUS_LABEL,
  OPPORTUNITY_TYPE_LABEL,
  type OpportunityStatus,
} from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

interface Props {
  items: Opportunity[]
}

defineProps<Props>()
const emit = defineEmits<{
  selectOpportunity: [opp: Opportunity]
}>()

function formatDeadline(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function deadlineColor(d: string | null): 'error' | 'warning' | 'neutral' {
  if (!d) return 'neutral'
  const days = (new Date(d).getTime() - Date.now()) / 86_400_000
  if (days < 0) return 'error'
  if (days <= 7) return 'warning'
  return 'neutral'
}

function formatValue(opp: Opportunity) {
  if (!opp.estimatedValue) return '—'
  const num = Number(opp.estimatedValue)
  if (Number.isNaN(num)) return `${opp.estimatedValue} ${opp.currency}`
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${opp.currency}`
}

function ownerLabel(opp: Opportunity) {
  if (!opp.ownerUserId) return '—'
  return [opp.ownerFirstName, opp.ownerLastName].filter(Boolean).join(' ') || opp.ownerEmail || '—'
}

function statusColor(s: OpportunityStatus): 'warning' | 'success' | 'error' {
  return s === 'pending' ? 'warning' : s === 'accepted' ? 'success' : 'error'
}
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default bg-default shadow-sm">
    <table class="w-full text-sm">
      <thead class="bg-elevated/50 text-left">
        <tr>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Title</th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Status
          </th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Source
          </th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Value</th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Deadline
          </th>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Assigned to
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr
          v-for="opp in items"
          :key="opp.id"
          class="cursor-pointer transition-colors hover:bg-elevated/40"
          @click="emit('selectOpportunity', opp)"
        >
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="font-medium text-default">{{ opp.title }}</span>
            </div>
          </td>
          <td class="px-4 py-3">
            <UBadge
              variant="subtle"
              :color="statusColor(opp.status)"
              size="xs"
              :label="OPPORTUNITY_STATUS_LABEL[opp.status]"
            />
            <div v-if="opp.tags?.length" class="mt-1 flex flex-wrap gap-1">
              <UBadge
                v-for="t in opp.tags.slice(0, 3)"
                :key="t"
                variant="subtle"
                color="neutral"
                size="xs"
                :label="t"
              />
              <span v-if="opp.tags.length > 3" class="text-xs text-dimmed">
                +{{ opp.tags.length - 3 }}
              </span>
            </div>
          </td>
          <td class="px-4 py-3 text-xs text-muted">
            {{ OPPORTUNITY_SOURCE_LABEL[opp.source] }} ·
            {{ OPPORTUNITY_TYPE_LABEL[opp.type] }}
          </td>
          <td class="px-4 py-3 text-xs font-medium text-default">{{ formatValue(opp) }}</td>
          <td class="px-4 py-3 text-xs">
            <UBadge
              v-if="opp.deadline"
              variant="subtle"
              :color="deadlineColor(opp.deadline)"
              size="xs"
              :label="formatDeadline(opp.deadline)"
            />
            <span v-else class="text-dimmed">—</span>
          </td>
          <td class="px-4 py-3 text-xs text-muted">{{ ownerLabel(opp) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
