<script setup lang="ts">
import type { AdminUser } from '@/composables/useAdminUsers'

interface Props {
  user: AdminUser
}

const props = defineProps<Props>()
const emit = defineEmits<{
  deactivate: [user: AdminUser]
  reactivate: [user: AdminUser]
  manageRoles: [user: AdminUser]
}>()

const initials = computed(() => {
  const f = props.user.firstName.charAt(0).toUpperCase()
  const l = props.user.lastName.charAt(0).toUpperCase()
  return `${f}${l}`
})

const badge = computed<{ color: 'success' | 'warning' | 'neutral' | 'error'; label: string }>(
  () => {
    if (props.user.deactivatedAt) return { color: 'neutral', label: 'Deactivated' }
    if (props.user.lockedUntil && new Date(props.user.lockedUntil) > new Date()) {
      return { color: 'error', label: 'Locked' }
    }
    if (props.user.status === 'pending_verification') return { color: 'warning', label: 'Pending' }
    if (props.user.status === 'suspended') return { color: 'neutral', label: 'Suspended' }
    return { color: 'success', label: 'Active' }
  }
)
</script>

<template>
  <li
    class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {{ initials }}
      </div>
      <div class="min-w-0">
        <p class="text-sm font-medium text-default">{{ user.firstName }} {{ user.lastName }}</p>
        <p class="truncate text-xs text-muted">{{ user.email }}</p>
        <div v-if="user.roles?.length" class="mt-1 flex flex-wrap gap-1">
          <UBadge
            v-for="role in user.roles"
            :key="role.id"
            variant="subtle"
            color="neutral"
            size="xs"
            :label="role.name"
          />
        </div>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <UBadge :color="badge.color" :label="badge.label" variant="subtle" size="sm" />
      <UButton
        size="sm"
        variant="ghost"
        icon="i-lucide-shield"
        label="Roles"
        @click="emit('manageRoles', user)"
      />
      <UButton
        v-if="user.deactivatedAt"
        size="sm"
        variant="ghost"
        icon="i-lucide-circle-check"
        label="Reactivate"
        @click="emit('reactivate', user)"
      />
      <UButton
        v-else
        size="sm"
        variant="ghost"
        color="error"
        icon="i-lucide-user-x"
        label="Deactivate"
        @click="emit('deactivate', user)"
      />
    </div>
  </li>
</template>
