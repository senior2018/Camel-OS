<script setup lang="ts">
import type { UpsertRolePayload } from '@@/shared/schemas/role'
import type { AdminRoleSummary } from '@/composables/useAdminRoles'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Roles — Camel OS' })

const { data, status, getRole, createRole, updateRole, deleteRole } = useAdminRoles()

const showEditor = ref(false)
const submitting = ref(false)
const editorInitial = ref<{
  id?: string
  name: string
  description: string | null
  mfaRequired: boolean
  isSystem: boolean
  permissions: Array<{ module: string; action: 'read' | 'create' | 'update' | 'delete' | 'admin' }>
} | null>(null)

function openCreate() {
  editorInitial.value = null
  showEditor.value = true
}

async function openEdit(role: AdminRoleSummary) {
  const detail = await getRole(role.id)
  if (!detail) return
  editorInitial.value = {
    id: detail.role.id,
    name: detail.role.name,
    description: detail.role.description,
    mfaRequired: detail.role.mfaRequired,
    isSystem: detail.role.isSystem,
    permissions: detail.permissions.map((p) => ({
      module: p.module,
      action: p.action as 'read' | 'create' | 'update' | 'delete' | 'admin',
    })),
  }
  showEditor.value = true
}

async function handleSubmit(payload: UpsertRolePayload) {
  submitting.value = true
  const ok = editorInitial.value?.id
    ? await updateRole(editorInitial.value.id, payload)
    : await createRole(payload)
  submitting.value = false
  if (ok) showEditor.value = false
}

const toast = useToast()
const confirmDelete = ref<AdminRoleSummary | null>(null)

async function confirmAndDelete() {
  if (!confirmDelete.value) return
  const role = confirmDelete.value
  confirmDelete.value = null
  if (role.memberCount > 0) {
    toast.add({
      title: 'Cannot delete',
      description: `${role.memberCount} user(s) still hold this role. Reassign them first.`,
      color: 'warning',
    })
    return
  }
  await deleteRole(role)
}
</script>

<template>
  <div class="space-y-8">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Roles &amp; permissions</h1>
        <p class="mt-1 text-sm text-muted">
          Define what users can do per module. System roles can be edited but not deleted.
        </p>
      </div>
      <UButton size="lg" icon="i-lucide-plus" label="New role" @click="openCreate" />
    </header>

    <section>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">All roles</h2>
            <UBadge variant="subtle" color="neutral" size="sm">
              {{ data?.roles.length ?? 0 }}
            </UBadge>
          </div>
        </template>

        <div v-if="status === 'pending'" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <div v-else-if="!data?.roles.length" class="py-8 text-center text-sm text-muted">
          No roles yet. Create one to start assigning permissions.
        </div>

        <ul v-else class="divide-y divide-default">
          <AdminRoleRow
            v-for="role in data.roles"
            :key="role.id"
            :role="role"
            @edit="openEdit"
            @delete="confirmDelete = $event"
          />
        </ul>
      </UCard>
    </section>

    <AdminRoleEditorModal
      v-model:open="showEditor"
      :initial="editorInitial"
      :submitting="submitting"
      @submit="handleSubmit"
    />

    <UModal
      :open="!!confirmDelete"
      title="Delete role?"
      @update:open="!$event && (confirmDelete = null)"
    >
      <template #body>
        <p class="text-sm text-muted">
          This will permanently remove the
          <span class="font-medium text-default">{{ confirmDelete?.name }}</span> role and its
          permissions. This cannot be undone.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" label="Cancel" @click="confirmDelete = null" />
          <UButton color="error" label="Delete role" @click="confirmAndDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
