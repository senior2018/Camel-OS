<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: false,
})

const route = useRoute()
const token = computed(() => route.query.token as string | undefined)

const schema = z
  .object({
    password: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type Schema = z.output<typeof schema>

const state = reactive({ password: '', confirmPassword: '' })
const error = ref<string | null>(null)
const success = ref(false)

async function onSubmit(_payload: FormSubmitEvent<Schema>) {
  error.value = null
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, password: state.password },
    })
    success.value = true
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await navigateTo('/login')
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    error.value = msg ?? 'Something went wrong. Please try again.'
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <div v-if="!token" class="flex flex-col items-center gap-4 py-6 text-center">
        <UIcon name="i-lucide-alert-circle" class="size-12 text-error" />
        <p class="text-sm text-muted">Invalid reset link. Please request a new one.</p>
        <UButton to="/forgot-password" variant="outline" size="lg"> Request new link </UButton>
      </div>

      <div v-else-if="success" class="flex flex-col items-center gap-4 py-6 text-center">
        <UIcon name="i-lucide-check-circle" class="size-12 text-success" />
        <h2 class="text-xl font-semibold">Password updated!</h2>
        <p class="text-sm text-muted">Redirecting you to sign in...</p>
      </div>

      <div v-else class="flex flex-col gap-6 p-2">
        <div class="flex flex-col gap-1">
          <h2 class="text-xl font-semibold">Set new password</h2>
          <p class="text-sm text-muted">Choose a strong password for your account.</p>
        </div>

        <UAlert v-if="error" color="error" variant="subtle" :description="error" />

        <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
          <UFormField label="New password" name="password" required>
            <UInput
              v-model="state.password"
              type="password"
              placeholder="At least 8 characters"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Confirm password" name="confirmPassword" required>
            <UInput
              v-model="state.confirmPassword"
              type="password"
              placeholder="Repeat your password"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UButton type="submit" size="lg" block> Reset password </UButton>
        </UForm>
      </div>
    </UPageCard>
  </div>
</template>
