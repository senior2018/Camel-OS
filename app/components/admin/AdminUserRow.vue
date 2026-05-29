<script setup lang="ts">
import type { AdminUser } from '@/composables/useAdminUsers'

interface Props {
  user: AdminUser
  /** True when the signed-in admin is the super admin. Drives delete-button gating
   *  for admin-on-admin deletes (only super admin can delete another admin). */
  callerIsSuperAdmin?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  deactivate: [user: AdminUser]
  reactivate: [user: AdminUser]
  manageRoles: [user: AdminUser]
  edit: [user: AdminUser]
  delete: [user: AdminUser]
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

// S5b — hide the "System Administrator" role pill on the super admin row;
// the single "Super Administrator" badge next to the name replaces both.
const displayRoles = computed(() =>
  props.user.isSuperAdmin
    ? (props.user.roles ?? []).filter((r) => r.name !== 'System Administrator')
    : (props.user.roles ?? [])
)

const isAdminAccount = computed(
  () => props.user.role === 'system_admin' || props.user.role === 'org_admin'
)

const deleteDisabledReason = computed(() => {
  if (props.user.isSuperAdmin) {
    return 'The super admin cannot be deleted. Transfer the role first.'
  }
  if (isAdminAccount.value && !props.callerIsSuperAdmin) {
    return 'Only the super admin can delete another admin.'
  }
  return null
})
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
        <div class="flex items-center gap-2">
          <p class="text-sm font-medium text-default">{{ user.firstName }} {{ user.lastName }}</p>
          <UBadge
            v-if="user.isSuperAdmin"
            variant="subtle"
            color="warning"
            size="xs"
            icon="i-lucide-crown"
            label="Super Administrator"
          />
        </div>
        <p class="truncate text-xs text-muted">{{ user.email }}</p>
        <div v-if="displayRoles.length" class="mt-1 flex flex-wrap gap-1">
          <UBadge
            v-for="role in displayRoles"
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
        icon="i-lucide-pencil"
        label="Edit"
        @click="emit('edit', user)"
      />
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
      <UTooltip :text="deleteDisabledReason ?? 'Permanently delete this user'">
        <UButton
          size="sm"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          aria-label="Delete"
          :disabled="!!deleteDisabledReason"
          @click="emit('delete', user)"
        />
      </UTooltip>
    </div>
  </li>
</template>
