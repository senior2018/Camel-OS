<script setup lang="ts">
import type { AdminRoleSummary } from '@/composables/useAdminRoles'
import type { AdminUser } from '@/composables/useAdminUsers'

interface Props {
  user: AdminUser | null
  roles: AdminRoleSummary[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const selected = ref<Set<string>>(new Set())
const initial = ref<Set<string>>(new Set())

const open = computed(() => props.user !== null)

watch(
  () => props.user,
  async (user) => {
    if (!user) return
    loading.value = true
    try {
      const { roles: current } = await $fetch<{ roles: Array<{ id: string }> }>(
        `/api/admin/users/${user.id}/roles`
      )
      selected.value = new Set(current.map((r) => r.id))
      initial.value = new Set(current.map((r) => r.id))
    } catch {
      toast.add({ title: 'Failed to load roles', color: 'error' })
    } finally {
      loading.value = false
    }
  }
)

function toggle(roleId: string) {
  const next = new Set(selected.value)
  if (next.has(roleId)) next.delete(roleId)
  else next.add(roleId)
  selected.value = next
}

const dirty = computed(() => {
  if (selected.value.size !== initial.value.size) return true
  for (const id of selected.value) if (!initial.value.has(id)) return true
  return false
})

async function save() {
  if (!props.user) return
  saving.value = true
  try {
    await $fetch(`/api/admin/users/${props.user.id}/roles`, {
      method: 'PUT',
      body: { roleIds: [...selected.value] },
    })
    toast.add({ title: 'Roles updated', description: props.user.email, color: 'success' })
    emit('saved')
    emit('close')
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Could not update roles.'
    toast.add({ title: 'Failed', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<!--  -->

<template>
  <UModal :open="open" title="Manage roles" @update:open="!$event && emit('close')">
    <template #body>
      <div v-if="user" class="space-y-4">
        <p class="text-sm text-muted">
          Assign one or more roles to
          <span class="font-medium text-default"> {{ user.firstName }} {{ user.lastName }} </span>
          ({{ user.email }}). Effective permissions are the union of all selected roles.
        </p>

        <div v-if="loading" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <div v-else-if="!roles.length" class="rounded-lg bg-elevated/40 p-4 text-sm text-muted">
          No roles defined yet.
          <ULink to="/admin/roles" class="font-medium text-primary hover:underline">
            Create a role first </ULink
          >.
        </div>

        <ul v-else class="divide-y divide-default rounded-lg border border-default">
          <li v-for="role in roles" :key="role.id" class="flex items-start gap-3 px-4 py-3">
            <UCheckbox
              :model-value="selected.has(role.id)"
              class="mt-1"
              @update:model-value="toggle(role.id)"
            />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium text-default">{{ role.name }}</p>
                <UBadge
                  v-if="role.isSystem"
                  variant="subtle"
                  color="primary"
                  size="xs"
                  label="System"
                />
                <UBadge
                  v-if="role.mfaRequired"
                  variant="subtle"
                  color="warning"
                  size="xs"
                  icon="i-lucide-shield-check"
                  label="MFA required"
                />
              </div>
              <p v-if="role.description" class="mt-0.5 text-xs text-muted">
                {{ role.description }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" label="Cancel" @click="emit('close')" />
        <UButton
          :disabled="!dirty"
          :loading="saving"
          label="Save changes"
          trailing-icon="i-lucide-check"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
