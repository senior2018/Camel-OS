<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: false,
})

const submitted = ref(false)

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true,
    size: 'lg',
  },
]

const schema = z.object({
  email: z.email('Invalid email'),
})

type Schema = z.output<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  await $fetch('/api/auth/forgot-password', {
    method: 'POST',
    body: payload.data,
  })

  submitted.value = true
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <div v-if="submitted" class="flex flex-col items-center gap-4 py-6 text-center">
        <UIcon name="i-lucide-mail-check" class="size-12 text-primary" />
        <h2 class="text-xl font-semibold">Check your inbox</h2>
        <p class="text-sm text-muted">
          If an account exists for that email, you'll receive a password reset link shortly.
        </p>
        <UButton to="/login" variant="outline" size="lg" class="mt-2"> Back to sign in </UButton>
      </div>

      <UAuthForm
        v-else
        :schema="schema"
        :fields="fields"
        title="Forgot your password?"
        icon="i-lucide-lock-keyhole"
        submit-label="Send reset link"
        @submit="onSubmit"
      >
        <template #description>
          <p class="text-sm">Enter your email and we'll send you a reset link.</p>
        </template>
        <template #footer>
          <ULink to="/login" class="text-sm font-medium text-primary"> Back to sign in </ULink>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
