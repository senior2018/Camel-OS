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

const toast = useToast()

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    const result = await $fetch<{ mfaRequired?: boolean; mfaChallengeToken?: string }>(
      '/api/auth/login',
      { method: 'POST', body: payload.data }
    )
    if (result.mfaRequired && result.mfaChallengeToken) {
      await navigateTo(
        `/mfa-challenge?token=${encodeURIComponent(result.mfaChallengeToken)}&redirect=${encodeURIComponent(redirectTo.value)}`
      )
      return
    }
    await navigateTo(redirectTo.value)
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'An error occurred. Please try again.'
    toast.add({ title: 'Login failed', description: msg, color: 'error' })
  }
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
        :loading-auto="true"
        @submit="onSubmit"
      >
        <template #description>
          <p class="text-sm">
            New here?
            <ULink to="/register" class="font-medium text-primary">Create an account</ULink>.
          </p>
        </template>
        <template #password-hint>
          <ULink to="/forgot-password" class="text-sm font-medium text-primary">
            Forgot password?
          </ULink>
        </template>
        <template #footer>
          By signing in, you agree to our
          <ULink to="#" class="font-medium text-primary">Terms of Service</ULink>.
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
