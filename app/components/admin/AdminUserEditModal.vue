<script setup lang="ts">
import type { AdminUser } from '@/composables/useAdminUsers'

interface Props {
  user: AdminUser | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const open = computed({
  get: () => !!props.user,
  set: (v) => {
    if (!v) emit('close')
  },
})

const state = reactive({
  firstName: '',
  lastName: '',
  email: '',
  mfaRequired: false,
})

const submitting = ref(false)

watch(
  () => props.user,
  (u) => {
    if (!u) return
    state.firstName = u.firstName
    state.lastName = u.lastName
    state.email = u.email
    state.mfaRequired = !!(u as AdminUser & { mfaRequired?: boolean }).mfaRequired
  },
  { immediate: true }
)

async function save() {
  if (!props.user) return
  submitting.value = true
  try {
    await $fetch(`/api/admin/users/${props.user.id}`, {
      method: 'PATCH',
      body: {
        firstName: state.firstName,
        lastName: state.lastName,
        email: state.email,
        mfaRequired: state.mfaRequired,
      },
    })
    toast.add({ title: 'User updated', color: 'success' })
    emit('saved')
    emit('close')
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Update failed.'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Edit user">
    <template #body>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField label="First name" required>
          <UInput v-model="state.firstName" class="w-full" />
        </UFormField>
        <UFormField label="Last name" required>
          <UInput v-model="state.lastName" class="w-full" />
        </UFormField>
        <UFormField label="Email" required class="sm:col-span-2">
          <UInput v-model="state.email" type="email" class="w-full" />
        </UFormField>
        <UCheckbox
          v-model="state.mfaRequired"
          label="Require MFA on this user's account"
          class="sm:col-span-2"
        />
      </div>
    </template>
    <template #footer>
      <div class="ml-auto flex gap-3">
        <UButton variant="ghost" label="Cancel" @click="emit('close')" />
        <UButton :loading="submitting" label="Save changes" @click="save" />
      </div>
    </template>
  </UModal>
</template>
