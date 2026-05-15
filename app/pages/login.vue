<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: false,
})

const route = useRoute()

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true,
    size: 'lg',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    required: true,
    size: 'lg',
  },
]

const providers = [
  {
    label: 'Google',
    icon: 'devicon:google',
    onClick: () => {
      window.location.href = '/api/auth/google'
    },
  },
]

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters'),
})

type Schema = z.output<typeof schema>

const redirectTo = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.length > 0 ? redirect : '/dashboard'
})

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  await $fetch('/api/auth/login', {
    method: 'POST',
    body: payload.data,
  })

  await navigateTo(redirectTo.value)
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        :providers="providers"
        title="Welcome back!"
        icon="i-lucide-lock"
        @submit="onSubmit"
      >
        <template #description>
          <p class="text-sm">
            New here?
            <ULink to="/register" class="font-medium text-primary">Create an account</ULink>.
          </p>
        </template>
        <template #footer>
          By signing in, you agree to our
          <ULink to="#" class="font-medium text-primary">Terms of Service</ULink>.
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
