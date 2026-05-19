<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@@/shared/schemas/change-password'

definePageMeta({
  layout: 'auth',
})

useHead({ title: 'Change your password — Camel OS' })

const toast = useToast()
const { fetch: refreshSession, user } = useUserSession()

const forced = computed(
  () => (user.value as { mustChangePassword?: boolean } | null)?.mustChangePassword === true
)

const state = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })

async function onSubmit(payload: FormSubmitEvent<ChangePasswordFormValues>) {
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: payload.data.currentPassword,
        newPassword: payload.data.newPassword,
      },
    })
    toast.add({
      title: 'Password updated',
      description: 'You can now continue using the platform.',
      color: 'success',
    })
    await refreshSession()
    await navigateTo('/dashboard')
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Could not update password.'
    toast.add({ title: 'Failed', description: msg, color: 'error' })
  }
}
</script>

<template>
  <div>
    <div class="mb-8 text-center lg:text-left">
      <h1 class="text-3xl font-semibold tracking-tight text-default">
        {{ forced ? 'Set a new password' : 'Change your password' }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        <template v-if="forced">
          Your password has expired or an administrator has required a reset. Please choose a new
          password to continue.
        </template>
        <template v-else> Enter your current password and choose a new one. </template>
      </p>
    </div>

    <UForm
      :schema="changePasswordSchema"
      :state="state"
      class="flex flex-col gap-4"
      @submit="onSubmit"
    >
      <UFormField label="Current password" name="currentPassword" required>
        <UInput
          v-model="state.currentPassword"
          type="password"
          size="lg"
          class="w-full"
          autocomplete="current-password"
        />
      </UFormField>
      <UFormField label="New password" name="newPassword" required>
        <UInput
          v-model="state.newPassword"
          type="password"
          placeholder="At least 8 characters"
          size="lg"
          class="w-full"
          autocomplete="new-password"
        />
      </UFormField>
      <UFormField label="Confirm new password" name="confirmPassword" required>
        <UInput
          v-model="state.confirmPassword"
          type="password"
          size="lg"
          class="w-full"
          autocomplete="new-password"
        />
      </UFormField>

      <UButton type="submit" size="lg" block :loading-auto="true" trailing-icon="i-lucide-check">
        Update password
      </UButton>
    </UForm>
  </div>
</template>
