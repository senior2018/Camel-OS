<script setup lang="ts">
const props = defineProps<{ opportunityId: string }>()

interface Activity {
  id: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  userName: string | null
  userLastName: string | null
  userEmail: string | null
}

const { data } = useFetch<{ activities: Activity[] }>(
  () => `/api/opportunities/${props.opportunityId}/activities`,
  {
    key: () => `opportunity-activities-${props.opportunityId}`,
    default: () => ({ activities: [] }),
  }
)

const activities = computed(() => data.value?.activities ?? [])

type Meta = {
  label: string
  icon: string
  color: 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'error'
}

function meta(action: string): Meta {
  const map: Record<string, Meta> = {
    'opportunity:accepted': {
      label: 'Opportunity accepted',
      icon: 'i-lucide-check-circle',
      color: 'success',
    },
    'opportunity:rejected': {
      label: 'Opportunity rejected',
      icon: 'i-lucide-x-circle',
      color: 'error',
    },
    'opportunity:status': {
      label: 'Status changed',
      icon: 'i-lucide-refresh-cw',
      color: 'neutral',
    },
    'proposal:assignment': {
      label: 'Team member assigned',
      icon: 'i-lucide-user-plus',
      color: 'info',
    },
    'proposal:ready_for_review': {
      label: 'Sent for review',
      icon: 'i-lucide-send',
      color: 'primary',
    },
    'proposal:review': {
      label: 'Reviewer decision',
      icon: 'i-lucide-message-circle',
      color: 'warning',
    },
    'proposal:final_approval': {
      label: 'Final approval',
      icon: 'i-lucide-shield-check',
      color: 'success',
    },
    'proposal:status': {
      label: 'Proposal status changed',
      icon: 'i-lucide-refresh-cw',
      color: 'neutral',
    },
  }
  return map[action] ?? { label: action, icon: 'i-lucide-activity', color: 'neutral' }
}

function detailLine(a: Activity): string | null {
  const d = a.details
  if (!d) return null
  if (a.action === 'proposal:assignment') {
    return `${String(d.assignedName ?? '')} as ${String(d.role ?? '').replace(/_/g, ' ')}`
  }
  if (a.action === 'proposal:review') {
    return `${String(d.reviewerDecision ?? '').replace(/_/g, ' ')} — ${String(d.role ?? '').replace(/_/g, ' ')}`
  }
  if (a.action === 'proposal:final_approval') {
    return String(d.decision ?? '')
  }
  if (a.action === 'proposal:ready_for_review') {
    return `${String(d.reviewerCount ?? 0)} reviewer(s)`
  }
  if (d.comment) return String(d.comment)
  if (d.to) return `→ ${String(d.to)}`
  return null
}

function who(a: Activity): string {
  if (a.userName) return [a.userName, a.userLastName].filter(Boolean).join(' ')
  return a.userEmail?.split('@')[0] ?? 'Someone'
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-semibold text-default">Activity timeline</h3>
    </template>

    <div v-if="!activities.length" class="py-6 text-center text-sm text-muted">
      No activity yet.
    </div>

    <ol v-else class="space-y-0">
      <li
        v-for="(a, i) in activities"
        :key="a.id"
        class="flex gap-3 pb-4"
        :class="{ 'border-b border-default': i < activities.length - 1, 'pt-4': i > 0 }"
      >
        <UBadge :color="meta(a.action).color" variant="subtle" size="sm" class="h-fit">
          <UIcon :name="meta(a.action).icon" class="size-3.5" />
        </UBadge>
        <div class="flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <p class="text-sm font-medium text-default">{{ meta(a.action).label }}</p>
            <p class="whitespace-nowrap text-xs text-muted">{{ when(a.createdAt) }}</p>
          </div>
          <p class="text-xs text-muted">by {{ who(a) }}</p>
          <p v-if="detailLine(a)" class="mt-1 text-xs text-default">{{ detailLine(a) }}</p>
        </div>
      </li>
    </ol>
  </UCard>
</template>
