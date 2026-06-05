<script setup lang="ts">
interface Props {
  opportunityId: string
}

defineProps<Props>()

const props = defineProps<Props>()

const { data: activitiesData } = useFetch<{
  activities: Array<{
    id: string
    action: string
    details: Record<string, any> | null
    createdAt: string
    userName: string | null
    userLastName: string | null
    userEmail: string
  }>
}>(
  () => `/api/opportunities/${props.opportunityId}/activities`,
  {
    key: () => `opportunity-activities-${props.opportunityId}`,
    default: () => ({ activities: [] }),
  }
)

const activities = computed(() => activitiesData.value?.activities ?? [])

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'opportunity:reviewed': 'Reviewed opportunity',
    'opportunity:decision': 'Made go/no-go decision',
    'proposal:created': 'Created proposal',
    'proposal:assignment': 'Assigned team member',
    'proposal:ready_for_review': 'Marked ready for review',
    'proposal:review': 'Submitted review decision',
  }
  return labels[action] || action
}

function getActionIcon(action: string): string {
  const icons: Record<string, string> = {
    'opportunity:reviewed': 'i-lucide-eye',
    'opportunity:decision': 'i-lucide-check-circle',
    'proposal:created': 'i-lucide-file-text',
    'proposal:assignment': 'i-lucide-users',
    'proposal:ready_for_review': 'i-lucide-send',
    'proposal:review': 'i-lucide-message-circle',
  }
  return icons[action] || 'i-lucide-activity'
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    'opportunity:reviewed': 'blue',
    'opportunity:decision': 'green',
    'proposal:created': 'purple',
    'proposal:assignment': 'indigo',
    'proposal:ready_for_review': 'orange',
    'proposal:review': 'cyan',
  }
  return colors[action] || 'gray'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getUserName(firstName: string | null, lastN: string | null, email: string): string {
  if (firstName && lastN) return `${firstName} ${lastN}`
  if (firstName) return firstName
  return email.split('@')[0]
}
</script>

<template>
  <div>
    <UCard v-if="activities.length > 0">
      <template #header>
        <h3 class="font-semibold text-default">Activity Timeline</h3>
      </template>

      <div class="space-y-1">
        <div
          v-for="(activity, idx) in activities"
          :key="activity.id"
          class="flex gap-4 pb-4"
          :class="{ 'border-b border-default': idx < activities.length - 1 }"
        >
          <!-- Timeline dot -->
          <div class="flex flex-col items-center">
            <UBadge :color="getActionColor(activity.action)" variant="subtle" size="sm" class="ring-2 ring-default">
              <UIcon :name="getActionIcon(activity.action)" class="size-3" />
            </UBadge>
            <div
              v-if="idx < activities.length - 1"
              class="h-8 w-0.5 bg-default"
            />
          </div>

          <!-- Content -->
          <div class="flex-1 pt-1">
            <div class="flex items-baseline justify-between gap-2">
              <p class="font-medium text-default">{{ getActionLabel(activity.action) }}</p>
              <p class="whitespace-nowrap text-xs text-muted">
                {{ formatDate(activity.createdAt) }}
              </p>
            </div>

            <p v-if="activity.userName || activity.userEmail" class="text-xs text-muted">
              by {{ getUserName(activity.userName, activity.userLastName, activity.userEmail) }}
            </p>

            <!-- Details -->
            <div v-if="activity.details" class="mt-2 space-y-1 text-xs text-muted">
              <div
                v-if="activity.details.decision"
                class="rounded-sm bg-default/40 px-2 py-1"
              >
                Decision:
                <span class="font-medium capitalize text-default">{{ activity.details.decision }}</span>
              </div>
              <div
                v-if="activity.details.role"
                class="rounded-sm bg-default/40 px-2 py-1"
              >
                Role:
                <span class="font-medium capitalize text-default">{{ activity.details.role }}</span>
              </div>
              <div
                v-if="activity.details.reviewerDecision"
                class="rounded-sm bg-default/40 px-2 py-1"
              >
                Review:
                <span class="font-medium capitalize text-default">{{ activity.details.reviewerDecision.replace(/_/g, ' ') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <div v-else class="rounded-lg border border-dashed border-default p-8 text-center">
      <UIcon name="i-lucide-inbox" class="mx-auto mb-2 size-6 text-muted" />
      <p class="text-sm text-muted">No activity yet</p>
    </div>
  </div>
</template>
