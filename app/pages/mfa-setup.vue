<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  // Minimal `auth` layout (no sidebar) — users can't browse protected nav
  // until MFA setup is complete. Once enabled, they land on /dashboard normally.
  layout: 'auth',
})

const toast = useToast()
const { fetch: refreshSession, user } = useUserSession()

const forced = computed(
  () => (user.value as { mustSetupMfa?: boolean } | null)?.mustSetupMfa === true
)
const userEmail = computed(() => (user.value as { email?: string } | null)?.email ?? '')

// Step machine: pick method → TOTP shows QR / Email shows "we've sent a code" →
// verify the 6-digit code → display the recovery codes.
type Step = 'method' | 'totp' | 'email' | 'verify' | 'recovery'
type Method = 'totp' | 'email'

const step = ref<Step>('method')
const method = ref<Method>('totp')
const qrDataUrl = ref('')
const manualSecret = ref('')
const recoveryCodes = ref<string[]>([])
const copied = ref(false)
const loading = ref(false)

const verifySchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code').regex(/^\d+$/, 'Digits only'),
})
type VerifySchema = z.output<typeof verifySchema>
const verifyState = reactive({ code: '' })

async function pickTotp() {
  loading.value = true
  try {
    await $fetch('/api/auth/mfa/select-method', { method: 'POST', body: { method: 'totp' } })
    const result = await $fetch<{ qrDataUrl: string; secret: string }>('/api/auth/mfa/setup', {
      method: 'POST',
    })
    qrDataUrl.value = result.qrDataUrl
    manualSecret.value = result.secret
    method.value = 'totp'
    step.value = 'totp'
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Could not start TOTP setup.'
    toast.add({ title: 'Error', description: msg, color: 'error' })
  } finally {
    loading.value = false
  }
}

async function pickEmail() {
  loading.value = true
  try {
    await $fetch('/api/auth/mfa/select-method', { method: 'POST', body: { method: 'email' } })
    method.value = 'email'
    step.value = 'email'
    toast.add({
      title: 'Code sent',
      description: `We just emailed a 6-digit code to ${userEmail.value}.`,
      color: 'success',
    })
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Could not send email code.'
    toast.add({ title: 'Error', description: msg, color: 'error' })
  } finally {
    loading.value = false
  }
}

async function resendEmail() {
  await $fetch('/api/auth/mfa/select-method', { method: 'POST', body: { method: 'email' } })
  toast.add({ title: 'New code sent', description: 'Check your inbox.', color: 'success' })
}

async function onVerify(payload: FormSubmitEvent<VerifySchema>) {
  try {
    const result = await $fetch<{ recoveryCodes: string[] }>('/api/auth/mfa/verify-setup', {
      method: 'POST',
      body: { code: payload.data.code },
    })
    recoveryCodes.value = result.recoveryCodes
    step.value = 'recovery'
    await refreshSession()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Invalid code. Please try again.'
    toast.add({ title: 'Verification failed', description: msg, color: 'error' })
  }
}

async function copyRecoveryCodes() {
  await navigator.clipboard.writeText(recoveryCodes.value.join('\n'))
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="mx-auto w-full max-w-lg">
    <div class="mb-8">
      <h1 class="text-2xl font-bold">Set up two-factor authentication</h1>
      <p class="mt-1 text-sm text-muted">Pick how you'd like to receive your sign-in codes.</p>
    </div>

    <UAlert
      v-if="forced"
      color="warning"
      variant="subtle"
      icon="i-lucide-shield-alert"
      title="MFA is required for your role"
      description="Complete setup below — the rest of the app is locked until you do."
      class="mb-6"
    />

    <!-- Step 0: Pick method -->
    <UPageCard v-if="step === 'method'" class="flex flex-col gap-4">
      <button
        type="button"
        :disabled="loading"
        class="flex items-start gap-4 rounded-lg border border-default p-4 text-left transition-colors hover:border-primary/40 hover:bg-elevated/40 disabled:opacity-50"
        @click="pickTotp"
      >
        <UIcon name="i-lucide-smartphone" class="size-6 shrink-0 text-primary" />
        <div>
          <p class="font-semibold text-default">Authenticator app (recommended)</p>
          <p class="mt-1 text-sm text-muted">
            Any TOTP app — Google Authenticator, Authy, 1Password, Microsoft Authenticator, etc.
            Works offline once set up.
          </p>
        </div>
      </button>

      <button
        type="button"
        :disabled="loading"
        class="flex items-start gap-4 rounded-lg border border-default p-4 text-left transition-colors hover:border-primary/40 hover:bg-elevated/40 disabled:opacity-50"
        @click="pickEmail"
      >
        <UIcon name="i-lucide-mail" class="size-6 shrink-0 text-primary" />
        <div>
          <p class="font-semibold text-default">Email code</p>
          <p class="mt-1 text-sm text-muted">
            We email a 6-digit code each time you sign in. No app to install.
          </p>
        </div>
      </button>
    </UPageCard>

    <!-- Step 1a: TOTP QR Code -->
    <UPageCard v-else-if="step === 'totp'" class="flex flex-col gap-6">
      <div class="flex flex-col items-center gap-4">
        <p class="text-sm font-medium">1. Scan this QR code in your authenticator app:</p>
        <img :src="qrDataUrl" alt="MFA QR Code" class="size-48 rounded-lg border border-muted" />
        <p class="text-xs text-muted">Or enter this key manually:</p>
        <UBadge variant="subtle" size="lg" class="font-mono tracking-widest">
          {{ manualSecret }}
        </UBadge>
      </div>

      <div class="flex gap-3">
        <UButton variant="ghost" size="lg" @click="step = 'method'">Back</UButton>
        <UButton size="lg" class="flex-1" @click="step = 'verify'"> Next: Verify code </UButton>
      </div>
    </UPageCard>

    <!-- Step 1b: Email code sent -->
    <UPageCard v-else-if="step === 'email'" class="flex flex-col gap-6">
      <div class="flex flex-col items-center gap-3 text-center">
        <UIcon name="i-lucide-mail-check" class="size-12 text-success" />
        <p class="text-sm font-medium">We've sent a 6-digit code to:</p>
        <p class="font-mono text-default">{{ userEmail }}</p>
        <p class="text-xs text-muted">The code expires in 5 minutes.</p>
      </div>

      <div class="flex gap-3">
        <UButton variant="ghost" size="lg" @click="step = 'method'">Back</UButton>
        <UButton variant="outline" size="lg" @click="resendEmail">Resend code</UButton>
        <UButton size="lg" class="flex-1" @click="step = 'verify'"> Next: Enter code </UButton>
      </div>
    </UPageCard>

    <!-- Step 2: Verify code -->
    <UPageCard v-else-if="step === 'verify'" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h2 class="font-semibold">
          {{ method === 'email' ? 'Enter the emailed code' : 'Verify your authenticator' }}
        </h2>
        <p class="text-sm text-muted">
          {{
            method === 'email'
              ? `Enter the 6-digit code we just sent to ${userEmail}.`
              : 'Enter the 6-digit code shown in your app.'
          }}
        </p>
      </div>

      <UForm
        :schema="verifySchema"
        :state="verifyState"
        class="flex flex-col gap-4"
        @submit="onVerify"
      >
        <UFormField label="Verification code" name="code">
          <UInput
            v-model="verifyState.code"
            placeholder="000000"
            maxlength="6"
            autocomplete="one-time-code"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton variant="ghost" size="lg" @click="step = method === 'email' ? 'email' : 'totp'">
            Back
          </UButton>
          <UButton type="submit" size="lg" class="flex-1" :loading-auto="true">
            Verify &amp; enable
          </UButton>
        </div>
      </UForm>
    </UPageCard>

    <!-- Step 3: Recovery codes -->
    <UPageCard v-else-if="step === 'recovery'" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
          <h2 class="font-semibold">MFA enabled successfully!</h2>
        </div>
        <p class="text-sm text-muted">
          Save these recovery codes somewhere safe. Each code can only be used once — they work even
          if you lose access to your {{ method === 'email' ? 'inbox' : 'authenticator' }}.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2 rounded-lg bg-elevated p-4">
        <span v-for="code in recoveryCodes" :key="code" class="font-mono text-sm">{{ code }}</span>
      </div>

      <div class="flex gap-3">
        <UButton
          variant="outline"
          size="lg"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          class="flex-1"
          @click="copyRecoveryCodes"
        >
          {{ copied ? 'Copied!' : 'Copy all codes' }}
        </UButton>
        <UButton size="lg" class="flex-1" @click="navigateTo('/dashboard')"> Done </UButton>
      </div>
    </UPageCard>
  </div>
</template>
