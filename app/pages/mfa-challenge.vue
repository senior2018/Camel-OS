<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: false,
})

const route = useRoute()
const toast = useToast()

const token = computed(() => {
  const t = route.query.token
  return typeof t === 'string' ? t : ''
})

const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.length > 0 ? r : '/dashboard'
})

const useRecovery = ref(false)

const schema = computed(() =>
  useRecovery.value
    ? z.object({ code: z.string().min(1, 'Recovery code is required') })
    : z.object({ code: z.string().length(6, 'Enter the 6-digit code').regex(/^\d+$/, 'Digits only') })
)

const state = reactive({ code: '' })

type Schema = { code: string }

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await $fetch('/api/auth/mfa/challenge', {
      method: 'POST',
      body: { mfaChallengeToken: token.value, code: payload.data.code },
    })
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
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <div class="flex flex-col gap-6 p-4">
        <div class="flex flex-col items-center gap-2 text-center">
          <UIcon name="i-lucide-shield-check" class="size-10 text-primary" />
          <h1 class="text-2xl font-bold">Two-Factor Authentication</h1>
          <p class="text-sm text-muted">
            {{ useRecovery ? 'Enter one of your recovery codes.' : 'Enter the 6-digit code from your authenticator app.' }}
          </p>
        </div>

        <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
          <UFormField :label="useRecovery ? 'Recovery code' : 'Authentication code'" name="code">
            <UInput
              v-model="state.code"
              :placeholder="useRecovery ? 'XXXXXX-XXXXXX-XXXXXX' : '000000'"
              :maxlength="useRecovery ? undefined : 6"
              autocomplete="one-time-code"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UButton type="submit" size="lg" block :loading-auto="true">
            Verify
          </UButton>
        </UForm>

        <div class="text-center">
          <UButton variant="ghost" size="sm" @click="toggleMode">
            {{ useRecovery ? 'Use authenticator app instead' : 'Use a recovery code instead' }}
          </UButton>
        </div>

        <p class="text-center text-sm text-muted">
          <ULink to="/login" class="font-medium text-primary">Back to login</ULink>
        </p>
      </div>
    </UPageCard>
  </div>
</template>
