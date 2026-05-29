<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
})

useHead({ title: 'Two-factor authentication — Camel OS' })

const route = useRoute()
const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const token = computed(() => {
  const t = route.query.token
  return typeof t === 'string' ? t : ''
})

// The login response now hands us the method (`totp` or `email`) so we can show
// the right copy. Falls back to `totp` if not provided (older sessions, etc.).
const method = computed(() => {
  const m = route.query.method
  return m === 'email' ? 'email' : 'totp'
})

const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.length > 0 ? r : '/dashboard'
})

const useRecovery = ref(false)
const resending = ref(false)

const schema = computed(() =>
  useRecovery.value
    ? z.object({ code: z.string().min(1, 'Recovery code is required') })
    : z.object({
        code: z.string().length(6, 'Enter the 6-digit code').regex(/^\d+$/, 'Digits only'),
      })
)

const state = reactive({ code: '' })

type Schema = { code: string }

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await $fetch('/api/auth/mfa/challenge', {
      method: 'POST',
      body: { mfaChallengeToken: token.value, code: payload.data.code },
    })
    await refreshSession()
    await navigateTo(redirectTo.value)
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Invalid code. Please try again.'
    toast.add({ title: 'Verification failed', description: msg, color: 'error' })
  }
}

function toggleMode() {
  useRecovery.value = !useRecovery.value
  state.code = ''
}

async function resendEmail() {
  if (resending.value) return
  resending.value = true
  try {
    await $fetch('/api/auth/mfa/resend-email', {
      method: 'POST',
      body: { mfaChallengeToken: token.value },
    })
    toast.add({
      title: 'New code sent',
      description: 'Check your inbox for the latest 6-digit code.',
      color: 'success',
    })
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Could not resend the code.'
    toast.add({ title: 'Resend failed', description: msg, color: 'error' })
  } finally {
    resending.value = false
  }
}

const primaryCopy = computed(() => {
  if (useRecovery.value) return 'Enter one of your saved recovery codes.'
  if (method.value === 'email') return 'Enter the 6-digit code we just emailed you.'
  return 'Enter the 6-digit code from your authenticator app.'
})

const fieldLabel = computed(() => {
  if (useRecovery.value) return 'Recovery code'
  if (method.value === 'email') return 'Email code'
  return 'Authenticator code'
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col items-center gap-4 text-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <UIcon
          :name="method === 'email' ? 'i-lucide-mail' : 'i-lucide-shield-check'"
          class="size-8 text-primary"
        />
      </div>
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">
          Two-factor authentication
        </h1>
        <p class="mt-2 text-sm text-muted">{{ primaryCopy }}</p>
      </div>
    </div>

    <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
      <UFormField :label="fieldLabel" name="code">
        <UInput
          v-model="state.code"
          :placeholder="useRecovery ? 'XXXXXX-XXXXXX-XXXXXX' : '000000'"
          :maxlength="useRecovery ? undefined : 6"
          autocomplete="one-time-code"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        size="lg"
        block
        :loading-auto="true"
        trailing-icon="i-lucide-arrow-right"
      >
        Verify
      </UButton>
    </UForm>

    <div class="flex flex-col items-center gap-1 text-center">
      <UButton variant="ghost" size="sm" @click="toggleMode">
        {{
          useRecovery
            ? `Use ${method === 'email' ? 'email code' : 'authenticator app'} instead`
            : 'Use a recovery code instead'
        }}
      </UButton>
      <UButton
        v-if="method === 'email' && !useRecovery"
        variant="ghost"
        size="sm"
        :loading="resending"
        @click="resendEmail"
      >
        Resend email code
      </UButton>
    </div>

    <p class="text-center text-sm text-muted">
      <ULink to="/login" class="font-medium text-primary hover:underline">Back to sign in</ULink>
    </p>
  </div>
</template>
