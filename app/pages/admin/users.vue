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
  deleteUser,
  reactivateUser,
  revokeInvitation,
  resendInvitation,
} = useAdminUsers()

// Roles needed for the invite modal + the manage-roles modal — fetched once at page load.
const { data: rolesData } = useAdminRoles()

const showInviteModal = ref(false)
const inviting = ref(false)
const managingRolesFor = ref<AdminUser | null>(null)
const editingUser = ref<AdminUser | null>(null)
const pendingDelete = ref<AdminUser | null>(null)

async function confirmDelete() {
  if (!pendingDelete.value) return
  const u = pendingDelete.value
  pendingDelete.value = null
  await deleteUser(u)
}

// S5b — super-admin transfer flow. Visible only when the signed-in user is
// the current super admin. The new super admin loses none of their existing
// roles; they just gain the un-deletable, un-demotable super flag and lose
// it from the caller.
const showTransfer = ref(false)
const transferTarget = ref<string | undefined>(undefined)
const transferPassword = ref('')
const transferring = ref(false)

const transferCandidates = computed(() =>
  (usersData.value?.users ?? [])
    .filter((u) => !u.isSuperAdmin && !u.deactivatedAt)
    .map((u) => ({
      label: `${u.firstName} ${u.lastName} — ${u.email}`,
      value: u.id,
    }))
)

function openTransfer() {
  transferTarget.value = undefined
  transferPassword.value = ''
  showTransfer.value = true
}

const toast = useToast()

async function confirmTransfer() {
  if (!transferTarget.value || !transferPassword.value) return
  transferring.value = true
  try {
    const res = await $fetch<{ success: boolean; newSuperAdminEmail: string }>(
      '/api/admin/users/transfer-super',
      {
        method: 'POST',
        body: {
          toUserId: transferTarget.value,
          currentPassword: transferPassword.value,
        },
      }
    )
    toast.add({
      title: 'Super admin transferred',
      description: `${res.newSuperAdminEmail} now holds the role.`,
      color: 'success',
    })
    showTransfer.value = false
    transferPassword.value = ''
    await refreshUsers()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Transfer failed.'
    toast.add({ title: 'Could not transfer', description: msg, color: 'error' })
  } finally {
    transferring.value = false
  }
}

// S5b — simple in-memory search across name + email + role.
const search = ref('')
const filteredUsers = computed<AdminUser[]>(() => {
  const items = usersData.value?.users ?? []
  const q = search.value.trim().toLowerCase()
  if (!q) return items
  return items.filter((u) => {
    const haystack = [u.firstName, u.lastName, u.email, ...(u.roles?.map((r) => r.name) ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
})

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
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by name, email, role…"
          size="md"
          class="w-full sm:w-72"
        />
        <UButton
          v-if="usersData?.callerIsSuperAdmin"
          size="lg"
          variant="outline"
          color="warning"
          icon="i-lucide-crown"
          label="Transfer super admin"
          @click="openTransfer"
        />
        <UButton
          size="lg"
          icon="i-lucide-user-plus"
          label="Invite user"
          @click="showInviteModal = true"
        />
      </div>
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
            v-for="user in filteredUsers"
            :key="user.id"
            :user="user"
            :caller-is-super-admin="usersData?.callerIsSuperAdmin ?? false"
            @deactivate="deactivateUser"
            @reactivate="reactivateUser"
            @manage-roles="managingRolesFor = $event"
            @edit="editingUser = $event"
            @delete="pendingDelete = $event"
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

    <AdminUserEditModal :user="editingUser" @close="editingUser = null" @saved="refreshUsers" />

    <UModal
      :open="!!pendingDelete"
      title="Delete user?"
      @update:open="!$event && (pendingDelete = null)"
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <p>
            Permanently delete
            <span class="font-medium text-default"
              >{{ pendingDelete?.firstName }} {{ pendingDelete?.lastName }}</span
            >
            ({{ pendingDelete?.email }})?
          </p>
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="This cannot be undone."
            description="Their login, MFA setup, and active sessions will be removed. Activity they logged in audit log will be kept but show 'Unknown user'. To preserve attribution, use Deactivate instead."
          />
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="pendingDelete = null" />
          <UButton color="error" label="Delete permanently" @click="confirmDelete" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showTransfer" title="Transfer super admin">
      <template #body>
        <div class="space-y-4 text-sm">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-crown"
            title="You'll lose super-admin status"
            description="After the transfer, the chosen user becomes the only super admin in this workspace. You stay an admin but lose the master-key flag — only the new super admin can take it back."
          />
          <UFormField label="New super admin" required>
            <USelectMenu
              v-model="transferTarget"
              :items="transferCandidates"
              value-key="value"
              placeholder="Pick a teammate…"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Confirm with your password"
            hint="Re-entering your password proves it's really you, not someone who walked up to your laptop."
            required
          >
            <UInput
              v-model="transferPassword"
              type="password"
              autocomplete="current-password"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showTransfer = false" />
          <UButton
            color="warning"
            icon="i-lucide-crown"
            label="Transfer"
            :loading="transferring"
            :disabled="!transferTarget || !transferPassword"
            @click="confirmTransfer"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
