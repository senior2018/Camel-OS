<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
})

useHead({ title: 'Reset your password — Camel OS' })

const submitted = ref(false)
const submittedEmail = ref('')

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'you@company.com',
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

  submittedEmail.value = payload.data.email
  submitted.value = true
}
</script>

<template>
  <div v-if="submitted" class="flex flex-col items-center gap-6 text-center">
    <div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
      <UIcon name="i-lucide-mail-check" class="size-8 text-primary" />
    </div>

    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold tracking-tight text-default">Check your inbox</h1>
      <p class="text-sm text-muted">
        If an account exists for
        <span class="font-medium text-default">{{ submittedEmail }}</span
        >, you'll receive a password reset link shortly.
      </p>
    </div>

    <UButton to="/login" variant="outline" size="lg" block>Back to sign in</UButton>

    <p class="text-xs text-muted">
      Didn't receive it? Check your spam folder, or
      <button
        type="button"
        class="font-medium text-primary hover:underline"
        @click="submitted = false"
      >
        try again</button
      >.
    </p>
  </div>

  <div v-else>
    <div class="mb-8 text-center lg:text-left">
      <h1 class="text-3xl font-semibold tracking-tight text-default">Forgot your password?</h1>
      <p class="mt-2 text-sm text-muted">
        Enter the email associated with your account and we'll send a reset link.
      </p>
    </div>

    <UAuthForm
      :schema="schema"
      :fields="fields"
      :loading-auto="true"
      :submit-button="{ label: 'Send reset link', trailingIcon: 'i-lucide-send' }"
      @submit="onSubmit"
    />

    <p class="mt-8 text-center text-sm text-muted">
      Remember your password?
      <ULink to="/login" class="font-medium text-primary hover:underline">Sign in</ULink>
    </p>
  </div>
</template>
