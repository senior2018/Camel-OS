<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { upsertRoleSchema, type UpsertRolePayload } from '@@/shared/schemas/role'
import type { PermissionAction } from '@@/shared/permissions'

interface PermissionTuple {
  module: string
  action: PermissionAction
}

interface RoleInitial {
  id?: string
  name: string
  description: string | null
  mfaRequired: boolean
  isSystem: boolean
  permissions: PermissionTuple[]
}

interface Props {
  open: boolean
  /** When `null`, the modal renders in create mode. */
  initial: RoleInitial | null
  submitting?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: UpsertRolePayload]
}>()

const state = reactive<{
  name: string
  description: string
  mfaRequired: boolean
  permissions: PermissionTuple[]
  isSystem: boolean
}>({
  name: '',
  description: '',
  mfaRequired: false,
  permissions: [],
  isSystem: false,
})

watch(
  () => [props.open, props.initial] as const,
  ([open, initial]) => {
    if (!open) return
    if (initial) {
      state.name = initial.name
      state.description = initial.description ?? ''
      state.mfaRequired = initial.mfaRequired
      state.permissions = [...initial.permissions]
      state.isSystem = initial.isSystem
    } else {
      state.name = ''
      state.description = ''
      state.mfaRequired = false
      state.permissions = []
      state.isSystem = false
    }
  },
  { immediate: true }
)

const title = computed(() => (props.initial ? 'Edit role' : 'Create role'))

function onSubmit(payload: FormSubmitEvent<UpsertRolePayload>) {
  emit('submit', payload.data)
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{ content: 'sm:max-w-4xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm
        id="admin-role-editor-form"
        :schema="upsertRoleSchema"
        :state="state"
        class="flex flex-col gap-6"
        @submit="onSubmit"
      >
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField label="Name" name="name" required>
            <UInput
              v-model="state.name"
              :disabled="state.isSystem"
              placeholder="e.g. Finance Officer"
              size="lg"
              class="w-full"
            />
            <template v-if="state.isSystem" #help>
              System roles cannot be renamed — edit their permissions instead.
            </template>
          </UFormField>
          <UFormField label="MFA required" name="mfaRequired">
            <div class="flex h-10 items-center">
              <USwitch v-model="state.mfaRequired" />
              <span class="ml-3 text-sm text-muted">
                Users holding this role must enable two-factor authentication.
              </span>
            </div>
          </UFormField>
        </div>

        <UFormField label="Description" name="description">
          <UTextarea
            v-model="state.description"
            placeholder="Short summary of what this role can do."
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <div>
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-default">Permissions</h3>
              <p class="text-xs text-muted">
                Choose which modules and actions this role can perform.
              </p>
            </div>
            <UBadge variant="subtle" color="neutral" size="sm">
              {{ state.permissions.length }} selected
            </UBadge>
          </div>
          <AdminPermissionMatrix v-model="state.permissions" />
        </div>
      </UForm>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" label="Cancel" @click="emit('update:open', false)" />
        <UButton
          type="submit"
          form="admin-role-editor-form"
          :loading="submitting"
          :label="initial ? 'Save changes' : 'Create role'"
          trailing-icon="i-lucide-check"
        />
      </div>
    </template>
  </UModal>
</template>
<!--  -->
