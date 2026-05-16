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
const accountLocked = ref(false)
const lockedEmail = ref('')
const resending = ref(false)
const resent = ref(false)

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
    const fetchErr = err as { status?: number; data?: { statusMessage?: string } }

    if (fetchErr.status === 423) {
      accountLocked.value = true
      lockedEmail.value = payload.data.email
      return
    }

    const msg = fetchErr.data?.statusMessage ?? 'An error occurred. Please try again.'
    toast.add({ title: 'Login failed', description: msg, color: 'error' })
  }
}

async function resendReset() {
  if (!lockedEmail.value || resending.value) return
  resending.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: lockedEmail.value },
    })
    resent.value = true
  } catch {
    toast.add({ title: 'Failed to resend', description: 'Please try again in a moment.', color: 'error' })
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">

      <!-- Account locked state -->
      <div v-if="accountLocked" class="flex flex-col items-center gap-6 p-6 text-center">
        <div class="flex size-16 items-center justify-center rounded-full bg-error/10">
          <UIcon name="i-lucide-lock" class="size-8 text-error" />
        </div>

        <div class="flex flex-col gap-2">
          <h2 class="text-xl font-bold">Account locked</h2>
          <p class="text-sm text-muted">
            Your account was locked after too many failed login attempts.
            We've sent a password reset link to your email address.
          </p>
          <p class="text-sm font-medium">Please check your inbox and follow the link to reset your password.</p>
        </div>

        <div class="flex w-full flex-col gap-3">
          <UButton
            v-if="!resent"
            variant="outline"
            block
            :loading="resending"
            icon="i-lucide-mail"
            @click="resendReset"
          >
            Resend reset email
          </UButton>
          <div v-else class="flex items-center justify-center gap-2 text-sm text-success">
            <UIcon name="i-lucide-circle-check" class="size-4" />
            Reset email sent — check your inbox
          </div>

          <UButton variant="ghost" block @click="accountLocked = false">
            Back to login
          </UButton>
        </div>

        <p class="text-xs text-muted">
          Once you've reset your password, you can sign in normally.
        </p>
      </div>

      <!-- Normal login form -->
      <UAuthForm
        v-else
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
