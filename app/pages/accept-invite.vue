<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { acceptInvitationFormSchema, type AcceptInvitationFormValues } from '@@/shared/schemas/auth'

definePageMeta({
  layout: 'auth',
})

useHead({ title: 'Accept your invitation — Camel OS' })

const route = useRoute()
const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const token = computed(() => {
  const t = route.query.token
  return typeof t === 'string' ? t : ''
})

interface InvitationPreview {
  email: string
  firstName: string
  lastName: string
  organizationName: string
  expiresAt: string
}

const previewState = ref<'loading' | 'ready' | 'invalid'>('loading')
const preview = ref<InvitationPreview | null>(null)
const previewError = ref('')

onMounted(async () => {
  if (!token.value) {
    previewState.value = 'invalid'
    previewError.value = 'Missing invitation token.'
    return
  }
  try {
    preview.value = await $fetch<InvitationPreview>(
      `/api/auth/invitation/${encodeURIComponent(token.value)}`
    )
    previewState.value = 'ready'
  } catch (err: unknown) {
    previewState.value = 'invalid'
    previewError.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'This invitation is invalid, expired, or has already been used.'
  }
})

const state = reactive({ password: '', confirmPassword: '' })

async function onSubmit(payload: FormSubmitEvent<AcceptInvitationFormValues>) {
  try {
    await $fetch('/api/auth/accept-invitation', {
      method: 'POST',
      body: { token: token.value, password: payload.data.password },
    })
    await refreshSession()
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Could not accept invitation. Please try again.'
    toast.add({ title: 'Failed to accept', description: msg, color: 'error' })
  }
}
</script>

<template>
  <!-- Loading -->
  <div v-if="previewState === 'loading'" class="flex flex-col items-center gap-4 py-12 text-center">
    <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
    <p class="text-sm text-muted">Verifying your invitation…</p>
  </div>

  <!-- Invalid / expired -->
  <div v-else-if="previewState === 'invalid'" class="flex flex-col items-center gap-6 text-center">
    <div class="flex size-16 items-center justify-center rounded-full bg-error/10">
      <UIcon name="i-lucide-circle-x" class="size-8 text-error" />
    </div>
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-default">Invitation unavailable</h1>
      <p class="mt-2 text-sm text-muted">{{ previewError }}</p>
    </div>
    <UButton to="/login" variant="outline" size="lg" block>Back to sign in</UButton>
  </div>

  <!-- Ready: set password -->
  <div v-else-if="previewState === 'ready' && preview">
    <div class="mb-8 text-center lg:text-left">
      <h1 class="text-3xl font-semibold tracking-tight text-default">Welcome to Camel OS</h1>
      <p class="mt-2 text-sm text-muted">
        You've been invited to join
        <span class="font-medium text-default">{{ preview.organizationName }}</span
        >. Set a password to activate your account.
      </p>
    </div>

    <UCard :ui="{ body: 'p-4' }" class="mb-6 bg-elevated/60">
      <dl class="grid grid-cols-3 gap-2 text-sm">
        <dt class="text-muted">Name</dt>
        <dd class="col-span-2 font-medium text-default">
          {{ preview.firstName }} {{ preview.lastName }}
        </dd>
        <dt class="text-muted">Email</dt>
        <dd class="col-span-2 font-medium text-default">{{ preview.email }}</dd>
      </dl>
    </UCard>

    <UForm
      :schema="acceptInvitationFormSchema"
      :state="state"
      class="flex flex-col gap-4"
      @submit="onSubmit"
    >
      <UFormField label="Password" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          placeholder="At least 8 characters"
          size="lg"
          class="w-full"
          autocomplete="new-password"
        />
      </UFormField>

      <UFormField label="Confirm password" name="confirmPassword" required>
        <UInput
          v-model="state.confirmPassword"
          type="password"
          placeholder="Re-enter your password"
          size="lg"
          class="w-full"
          autocomplete="new-password"
        />
      </UFormField>

      <UButton
        type="submit"
        size="lg"
        block
        :loading-auto="true"
        trailing-icon="i-lucide-arrow-right"
      >
        Activate account
      </UButton>
    </UForm>
  </div>
</template>
