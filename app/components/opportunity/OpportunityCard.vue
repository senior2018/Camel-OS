<script setup lang="ts">
import type { Opportunity } from '@/composables/useOpportunities'
import { OPPORTUNITY_SOURCE_LABEL, OPPORTUNITY_TYPE_LABEL } from '@@/shared/schemas/opportunity'

interface Props {
  opportunity: Opportunity
}

const props = defineProps<Props>()
const emit = defineEmits<{
  click: [opp: Opportunity]
}>()

const sourceLabel = computed(() => OPPORTUNITY_SOURCE_LABEL[props.opportunity.source])
const typeLabel = computed(() => OPPORTUNITY_TYPE_LABEL[props.opportunity.type])

const ownerLabel = computed(() => {
  const o = props.opportunity
  if (!o.ownerUserId) return null
  const name = [o.ownerFirstName, o.ownerLastName].filter(Boolean).join(' ')
  return name || o.ownerEmail || 'Assigned'
})

const ownerInitials = computed(() => {
  const o = props.opportunity
  if (!o.ownerUserId) return ''
  const f = (o.ownerFirstName ?? '').charAt(0).toUpperCase()
  const l = (o.ownerLastName ?? '').charAt(0).toUpperCase()
  return f + l || (o.ownerEmail?.charAt(0).toUpperCase() ?? '?')
})

const deadlineLabel = computed(() => {
  if (!props.opportunity.deadline) return null
  return new Date(props.opportunity.deadline).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})

const deadlineState = computed<'overdue' | 'soon' | 'normal' | null>(() => {
  if (!props.opportunity.deadline) return null
  const ms = new Date(props.opportunity.deadline).getTime() - Date.now()
  const days = Math.floor(ms / 86_400_000)
  if (days < 0) return 'overdue'
  if (days <= 7) return 'soon'
  return 'normal'
})

const valueLabel = computed(() => {
  const v = props.opportunity.estimatedValue
  if (!v) return null
  const num = Number(v)
  if (Number.isNaN(num)) return `${v} ${props.opportunity.currency}`
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${props.opportunity.currency}`
})
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group w-full select-none rounded-lg border border-default bg-default p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    @keydown.enter.prevent="emit('click', opportunity)"
    @keydown.space.prevent="emit('click', opportunity)"
  >
    <p class="line-clamp-2 text-sm font-medium text-default group-hover:text-primary">
      {{ opportunity.title }}
    </p>

    <div class="mt-2 flex flex-wrap items-center gap-1">
      <UBadge variant="subtle" color="primary" size="xs" :label="sourceLabel" />
      <UBadge variant="subtle" color="neutral" size="xs" :label="typeLabel" />
      <UBadge
        v-if="opportunity.approvedToPursueAt"
        variant="subtle"
        color="success"
        size="xs"
        icon="i-lucide-circle-check"
        label="Approved"
      />
    </div>

    <div v-if="valueLabel" class="mt-2 text-xs font-medium text-default">
      {{ valueLabel }}
    </div>

    <div class="mt-2 flex items-center justify-between text-xs">
      <div v-if="deadlineLabel" class="flex items-center gap-1">
        <UIcon
          name="i-lucide-calendar"
          :class="[
            'size-3.5',
            deadlineState === 'overdue'
              ? 'text-error'
              : deadlineState === 'soon'
                ? 'text-warning'
                : 'text-muted',
          ]"
        />
        <span
          :class="
            deadlineState === 'overdue'
              ? 'text-error'
              : deadlineState === 'soon'
                ? 'text-warning'
                : 'text-muted'
          "
        >
          {{ deadlineLabel }}
        </span>
      </div>
      <div v-else class="text-xs text-dimmed">No deadline</div>

      <UTooltip v-if="ownerLabel" :text="ownerLabel">
        <div
          class="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
        >
          {{ ownerInitials }}
        </div>
      </UTooltip>
    </div>
  </div>
</template>
