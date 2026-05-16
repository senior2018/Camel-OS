<script setup lang="ts">
definePageMeta({ layout: false })

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
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <div class="flex flex-col items-center gap-4 py-6 text-center">
        <UIcon name="i-lucide-mail" class="size-12 text-primary" />
        <h2 class="text-xl font-semibold">Check your inbox</h2>
        <p class="text-sm text-muted">
          We sent a verification link to
          <span class="font-medium text-default">{{ user?.email }}</span
          >. Click the link to activate your account.
        </p>

        <UAlert
          v-if="resent"
          color="success"
          variant="subtle"
          description="Verification email resent. Check your inbox."
        />
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />

        <div class="mt-2 flex flex-col gap-2 w-full">
          <UButton :loading="resending" variant="outline" block @click="resend">
            Resend verification email
          </UButton>
          <UButton to="/dashboard" variant="ghost" block> Continue to dashboard </UButton>
        </div>
      </div>
    </UPageCard>
  </div>
</template>
