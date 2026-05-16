<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'default',
})

const toast = useToast()

type Step = 'qr' | 'verify' | 'recovery'

const step = ref<Step>('qr')
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

onMounted(async () => {
  loading.value = true
  try {
    const result = await $fetch<{ qrDataUrl: string; secret: string }>(
      '/api/auth/mfa/setup',
      { method: 'POST' }
    )
    qrDataUrl.value = result.qrDataUrl
    manualSecret.value = result.secret
    step.value = 'qr'
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Failed to initialize MFA setup.'
    toast.add({ title: 'Error', description: msg, color: 'error' })
  } finally {
    loading.value = false
  }
})

async function onVerify(payload: FormSubmitEvent<VerifySchema>) {
  try {
    const result = await $fetch<{ recoveryCodes: string[] }>(
      '/api/auth/mfa/verify-setup',
      { method: 'POST', body: { code: payload.data.code } }
    )
    recoveryCodes.value = result.recoveryCodes
    step.value = 'recovery'
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
  <div class="mx-auto max-w-lg p-6">
    <div class="mb-8">
      <h1 class="text-2xl font-bold">Set up Two-Factor Authentication</h1>
      <p class="mt-1 text-sm text-muted">Protect your account with an authenticator app.</p>
    </div>

    <!-- Step 1: QR Code -->
    <UPageCard v-if="step === 'qr'" class="flex flex-col gap-6">
      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
      </div>

      <template v-else>
        <div class="flex flex-col items-center gap-4">
          <p class="text-sm font-medium">
            1. Install an authenticator app (Google Authenticator, Authy, 1Password, etc.)
          </p>
          <p class="text-sm font-medium">2. Scan this QR code:</p>
          <img :src="qrDataUrl" alt="MFA QR Code" class="size-48 rounded-lg border border-muted" />
          <p class="text-xs text-muted">Or enter this key manually:</p>
          <UBadge variant="subtle" size="lg" class="font-mono tracking-widest">
            {{ manualSecret }}
          </UBadge>
        </div>

        <UButton size="lg" block @click="step = 'verify'">
          Next: Verify code
        </UButton>
      </template>
    </UPageCard>

    <!-- Step 2: Verify code -->
    <UPageCard v-else-if="step === 'verify'" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h2 class="font-semibold">Verify your authenticator</h2>
        <p class="text-sm text-muted">Enter the 6-digit code shown in your app.</p>
      </div>

      <UForm :schema="verifySchema" :state="verifyState" class="flex flex-col gap-4" @submit="onVerify">
        <UFormField label="Authentication code" name="code">
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
          <UButton variant="ghost" size="lg" @click="step = 'qr'">Back</UButton>
          <UButton type="submit" size="lg" class="flex-1" :loading-auto="true">
            Verify &amp; Enable
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
          Save these recovery codes somewhere safe. Each code can only be used once. If you lose
          access to your authenticator, use one of these to sign in.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2 rounded-lg bg-elevated p-4">
        <span
          v-for="code in recoveryCodes"
          :key="code"
          class="font-mono text-sm"
        >{{ code }}</span>
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
        <UButton size="lg" class="flex-1" @click="navigateTo('/dashboard')">
          Done
        </UButton>
      </div>
    </UPageCard>
  </div>
</template>
