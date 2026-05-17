<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth'
})

useHead({ title: 'Sign in — Sahara Consult' })

const route = useRoute()

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'you@company.com',
    required: true,
    size: 'lg'
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    required: true,
    size: 'lg'
  }
]

const providers = [
  {
    label: 'Continue with Google',
    icon: 'devicon:google',
    onClick: () => {
      window.location.href = '/api/auth/google'
    }
  }
]

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters')
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
      body: { email: lockedEmail.value }
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
  <!-- Account locked state -->
  <div v-if="accountLocked" class="flex flex-col items-center gap-6 text-center">
    <div class="flex size-16 items-center justify-center rounded-full bg-error/10">
      <UIcon name="i-lucide-lock" class="size-8 text-error" />
    </div>

    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold tracking-tight text-default">Account locked</h1>
      <p class="text-sm text-muted">
        Your account was locked after too many failed login attempts.
        We've sent a password reset link to <span class="font-medium text-default">{{ lockedEmail }}</span>.
      </p>
    </div>

    <div class="flex w-full flex-col gap-3">
      <UButton
        v-if="!resent"
        variant="outline"
        size="lg"
        block
        :loading="resending"
        icon="i-lucide-mail"
        @click="resendReset"
      >
        Resend reset email
      </UButton>
      <div
        v-else
        class="flex items-center justify-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success"
      >
        <UIcon name="i-lucide-circle-check" class="size-4" />
        Reset email sent — check your inbox
      </div>

      <UButton variant="ghost" size="lg" block @click="accountLocked = false">
        Back to sign in
      </UButton>
    </div>
  </div>

  <!-- Normal login -->
  <div v-else>
    <div class="mb-8 text-center lg:text-left">
      <h1 class="text-3xl font-semibold tracking-tight text-default">Welcome back</h1>
      <p class="mt-2 text-sm text-muted">
        Sign in to your workspace to continue.
      </p>
    </div>

    <UAuthForm
      :schema="schema"
      :fields="fields"
      :providers="providers"
      :loading-auto="true"
      @submit="onSubmit"
    >
      <template #password-hint>
        <ULink to="/forgot-password" class="text-sm font-medium text-primary hover:underline">
          Forgot password?
        </ULink>
      </template>
    </UAuthForm>

    <p class="mt-8 text-center text-sm text-muted">
      Don't have an account?
      <ULink to="/register" class="font-medium text-primary hover:underline">Create one</ULink>
    </p>

    <p class="mt-4 text-center text-xs text-muted">
      By signing in, you agree to our
      <ULink to="#" class="font-medium text-default hover:text-primary">Terms</ULink>
      and
      <ULink to="#" class="font-medium text-default hover:text-primary">Privacy Policy</ULink>.
    </p>
  </div>
</template>
