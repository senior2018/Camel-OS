<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useHead({ title: 'Verify your email — Camel OS' })

const { user } = useUserSession()
const resending = ref(false)
const resent = ref(false)
const error = ref<string | null>(null)

async function resend() {
  resending.value = true
  error.value = null
  try {
    await $fetch('/api/auth/resend-verification', { method: 'POST' })
    resent.value = true
  } catch (err: unknown) {
    error.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Could not resend. Please try again.'
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 text-center">
    <div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
      <UIcon name="i-lucide-mail" class="size-8 text-primary" />
    </div>

    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold tracking-tight text-default">Check your inbox</h1>
      <p class="text-sm text-muted">
        We sent a verification link to
        <span class="font-medium text-default">{{ user?.email }}</span>.
        Click the link to activate your account.
      </p>
    </div>

    <UAlert
      v-if="resent"
      color="success"
      variant="subtle"
      icon="i-lucide-circle-check"
      description="Verification email resent — check your inbox."
      class="w-full"
    />
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :description="error"
      class="w-full"
    />

    <div class="flex w-full flex-col gap-3">
      <UButton :loading="resending" variant="outline" size="lg" block icon="i-lucide-refresh-cw" @click="resend">
        Resend verification email
      </UButton>
      <UButton to="/dashboard" variant="ghost" size="lg" block trailing-icon="i-lucide-arrow-right">
        Continue to dashboard
      </UButton>
    </div>

    <p class="text-xs text-muted">
      Wrong email? <ULink to="/login" class="font-medium text-primary hover:underline">Sign in with a different account</ULink>.
    </p>
  </div>
</template>
