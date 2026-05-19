<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { inviteUserSchema, type InviteUserPayload } from '@@/shared/schemas/admin'
import type { AdminRoleSummary } from '@/composables/useAdminRoles'

interface Props {
  open: boolean
  submitting?: boolean
  roles?: AdminRoleSummary[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: InviteUserPayload]
}>()

const state = reactive<{ firstName: string; lastName: string; email: string; roleId?: string }>({
  firstName: '',
  lastName: '',
  email: '',
  roleId: undefined,
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      state.firstName = ''
      state.lastName = ''
      state.email = ''
      state.roleId = undefined
    }
  }
)

const roleOptions = computed(() => (props.roles ?? []).map((r) => ({ label: r.name, value: r.id })))

function onSubmit(payload: FormSubmitEvent<InviteUserPayload>) {
  emit('submit', payload.data)
}
</script>

<template>
  <UModal :open="open" title="Invite a user" @update:open="emit('update:open', $event)">
    <template #body>
      <UForm
        id="admin-invite-user-form"
        :schema="inviteUserSchema"
        :state="state"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="First name" name="firstName" required>
            <UInput v-model="state.firstName" placeholder="Jane" size="lg" class="w-full" />
          </UFormField>
          <UFormField label="Last name" name="lastName" required>
            <UInput v-model="state.lastName" placeholder="Doe" size="lg" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Email" name="email" required>
          <UInput
            v-model="state.email"
            type="email"
            placeholder="jane@company.com"
            size="lg"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="roleOptions.length"
          label="Role"
          name="roleId"
          help="They'll be assigned this role on first login. You can change it later."
        >
          <USelectMenu
            v-model="state.roleId"
            :items="roleOptions"
            value-key="value"
            placeholder="Choose a role (optional)"
            size="lg"
            class="w-full"
          />
        </UFormField>
        <p class="text-xs text-muted">
          They'll receive an email with a link to set their password and access the workspace.
        </p>
      </UForm>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" label="Cancel" @click="emit('update:open', false)" />
        <UButton
          type="submit"
          form="admin-invite-user-form"
          :loading="submitting"
          label="Send invitation"
          trailing-icon="i-lucide-send"
        />
      </div>
    </template>
  </UModal>
</template>
