<script setup lang="ts">
import type { AuditLogItem } from '@/composables/useAdminAuditLog'

interface Props {
  item: AuditLogItem
}

const props = defineProps<Props>()

const { format } = useAuditFormatter()

const formatted = computed(() => format(props.item.resource, props.item.action, props.item.meta))

const userLabel = computed(() => {
  if (props.item.userEmail) {
    const name = [props.item.userFirstName, props.item.userLastName].filter(Boolean).join(' ')
    return name ? `${name} (${props.item.userEmail})` : props.item.userEmail
  }
  return 'System'
})

const timestamp = computed(() =>
  new Date(props.item.createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
)

const resourceLabels: Record<string, string> = {
  opportunity: 'Opportunity',
  auth: 'Authentication',
  user: 'User',
  user_invitation: 'Invitation',
  role: 'Role',
  password_policy: 'Password policy',
  audit_log: 'Audit log',
}

function resourceLabel(r: string) {
  return resourceLabels[r] ?? r
}
</script>

<template>
  <li class="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0">
    <div class="flex flex-wrap items-center gap-2">
      <UBadge variant="subtle" color="primary" size="sm" :label="resourceLabel(item.resource)" />
      <span class="font-medium text-default">{{ formatted.summary }}</span>
    </div>

    <div v-if="formatted.fields.length" class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span v-for="f in formatted.fields" :key="f.label">
        <span class="font-medium text-default">{{ f.label }}:</span> {{ f.value }}
      </span>
    </div>

    <p class="text-xs text-dimmed">{{ timestamp }} · {{ userLabel }}</p>
  </li>
</template>
