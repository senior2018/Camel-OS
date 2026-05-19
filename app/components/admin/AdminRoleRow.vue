<script setup lang="ts">
import type { AdminRoleSummary } from '@/composables/useAdminRoles'

interface Props {
  role: AdminRoleSummary
}

defineProps<Props>()
const emit = defineEmits<{
  edit: [role: AdminRoleSummary]
  delete: [role: AdminRoleSummary]
}>()
</script>

<template>
  <li
    class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-sm font-medium text-default">{{ role.name }}</p>
        <UBadge v-if="role.isSystem" variant="subtle" color="primary" size="xs" label="System" />
        <UBadge
          v-if="role.mfaRequired"
          variant="subtle"
          color="warning"
          size="xs"
          icon="i-lucide-shield-check"
          label="MFA required"
        />
      </div>
      <p v-if="role.description" class="mt-1 text-xs text-muted">
        {{ role.description }}
      </p>
      <p class="mt-1 text-xs text-dimmed">
        {{ role.permissionCount }} permission{{ role.permissionCount === 1 ? '' : 's' }} ·
        {{ role.memberCount }} member{{ role.memberCount === 1 ? '' : 's' }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <UButton
        size="sm"
        variant="ghost"
        icon="i-lucide-pencil"
        label="Edit"
        @click="emit('edit', role)"
      />
      <UButton
        v-if="!role.isSystem"
        size="sm"
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        label="Delete"
        @click="emit('delete', role)"
      />
    </div>
  </li>
</template>
