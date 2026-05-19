<script setup lang="ts">
import type { PendingInvitation } from '@/composables/useAdminUsers'

interface Props {
  invitation: PendingInvitation
}

defineProps<Props>()
const emit = defineEmits<{
  revoke: [invitation: PendingInvitation]
  resend: [invitation: PendingInvitation]
}>()

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <li
    class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium text-default">
        {{ invitation.firstName }} {{ invitation.lastName }}
      </p>
      <p class="truncate text-xs text-muted">{{ invitation.email }}</p>
      <p class="mt-1 text-xs text-dimmed">Expires {{ formatDate(invitation.expiresAt) }}</p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <UButton
        size="sm"
        variant="ghost"
        icon="i-lucide-mail"
        label="Resend"
        @click="emit('resend', invitation)"
      />
      <UButton
        size="sm"
        variant="ghost"
        color="error"
        icon="i-lucide-x"
        label="Revoke"
        @click="emit('revoke', invitation)"
      />
    </div>
  </li>
</template>
