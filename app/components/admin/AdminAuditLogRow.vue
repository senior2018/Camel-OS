<script setup lang="ts">
import type { AuditLogItem } from '@/composables/useAdminAuditLog'

interface Props {
  item: AuditLogItem
}

const props = defineProps<Props>()
const expanded = ref(false)

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

const hasMeta = computed(() => {
  const m = props.item.meta
  if (!m || typeof m !== 'object') return false
  return Object.keys(m as Record<string, unknown>).length > 0
})

const metaJson = computed(() => JSON.stringify(props.item.meta, null, 2))
</script>

<template>
  <li class="flex flex-col gap-2 py-3 text-sm first:pt-0 last:pb-0">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge variant="subtle" color="primary" size="sm" :label="item.resource" />
          <span class="font-mono text-xs text-default">{{ item.action }}</span>
          <span class="text-xs text-muted">·</span>
          <span class="truncate text-xs text-muted">{{ userLabel }}</span>
        </div>
        <p class="mt-1 truncate text-xs text-dimmed">
          {{ timestamp }}<span v-if="item.resourceId"> · {{ item.resourceId }}</span>
        </p>
      </div>
      <UButton
        v-if="hasMeta"
        size="xs"
        variant="ghost"
        :icon="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        :label="expanded ? 'Hide' : 'Details'"
        @click="expanded = !expanded"
      />
    </div>
    <pre
      v-if="expanded && hasMeta"
      class="overflow-x-auto rounded-md bg-elevated/50 p-3 text-xs text-default"
      >{{ metaJson }}</pre
    >
  </li>
</template>
