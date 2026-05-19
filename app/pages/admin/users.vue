<script setup lang="ts">
import type { InviteUserPayload } from '@@/shared/schemas/admin'
import type { AdminUser } from '@/composables/useAdminUsers'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Users — Camel OS' })

const {
  data: usersData,
  status,
  refresh: refreshUsers,
  inviteUser,
  deactivateUser,
  reactivateUser,
  revokeInvitation,
  resendInvitation,
} = useAdminUsers()

// Roles needed for the invite modal + the manage-roles modal — fetched once at page load.
const { data: rolesData } = useAdminRoles()

const showInviteModal = ref(false)
const inviting = ref(false)
const managingRolesFor = ref<AdminUser | null>(null)

async function handleInvite(payload: InviteUserPayload) {
  inviting.value = true
  const ok = await inviteUser(payload)
  inviting.value = false
  if (ok) showInviteModal.value = false
}

async function onRolesSaved() {
  await refreshUsers()
}
</script>

<template>
  <div class="space-y-8">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Users</h1>
        <p class="mt-1 text-sm text-muted">
          Invite teammates, manage access, and review the workspace roster.
        </p>
      </div>
      <UButton
        size="lg"
        icon="i-lucide-user-plus"
        label="Invite user"
        @click="showInviteModal = true"
      />
    </header>

    <section v-if="usersData?.pendingInvitations.length">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">Pending invitations</h2>
            <UBadge variant="subtle" color="warning" size="sm">
              {{ usersData.pendingInvitations.length }}
            </UBadge>
          </div>
        </template>

        <ul class="divide-y divide-default">
          <AdminPendingInviteRow
            v-for="invite in usersData.pendingInvitations"
            :key="invite.id"
            :invitation="invite"
            @revoke="revokeInvitation"
            @resend="resendInvitation"
          />
        </ul>
      </UCard>
    </section>

    <section>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">All users</h2>
            <UBadge variant="subtle" color="neutral" size="sm">
              {{ usersData?.users.length ?? 0 }}
            </UBadge>
          </div>
        </template>

        <div v-if="status === 'pending'" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <div v-else-if="!usersData?.users.length" class="py-8 text-center text-sm text-muted">
          No users yet. Invite your first teammate to get started.
        </div>

        <ul v-else class="divide-y divide-default">
          <AdminUserRow
            v-for="user in usersData.users"
            :key="user.id"
            :user="user"
            @deactivate="deactivateUser"
            @reactivate="reactivateUser"
            @manage-roles="managingRolesFor = $event"
          />
        </ul>
      </UCard>
    </section>

    <AdminInviteUserModal
      v-model:open="showInviteModal"
      :submitting="inviting"
      :roles="rolesData?.roles ?? []"
      @submit="handleInvite"
    />

    <AdminUserRolesModal
      :user="managingRolesFor"
      :roles="rolesData?.roles ?? []"
      @close="managingRolesFor = null"
      @saved="onRolesSaved"
    />
  </div>
</template>
