<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const token = route.query.token as string | undefined

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref('')

onMounted(async () => {
  if (!token) {
    status.value = 'error'
    errorMessage.value = 'No verification token found.'
    return
  }

  try {
    await $fetch('/api/auth/verify-email', {
      method: 'POST',
      body: { token },
    })
    status.value = 'success'
  } catch (err: unknown) {
    status.value = 'error'
    errorMessage.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'This verification link is invalid or has expired.'
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <div class="flex flex-col items-center gap-4 py-8 text-center">
        <template v-if="status === 'loading'">
          <UIcon name="i-lucide-loader-circle" class="size-12 text-primary animate-spin" />
          <p class="text-sm text-muted">Verifying your email...</p>
        </template>

        <template v-else-if="status === 'success'">
          <UIcon name="i-lucide-circle-check" class="size-12 text-success" />
          <h2 class="text-xl font-semibold">Email verified!</h2>
          <p class="text-sm text-muted">Your account is now active.</p>
          <UButton to="/dashboard" size="lg" class="mt-2">Go to dashboard</UButton>
        </template>

        <template v-else>
          <UIcon name="i-lucide-circle-x" class="size-12 text-error" />
          <h2 class="text-xl font-semibold">Verification failed</h2>
          <p class="text-sm text-muted">{{ errorMessage }}</p>
          <UButton to="/verify-email-sent" variant="outline" size="lg" class="mt-2">
            Request new link
          </UButton>
        </template>
      </div>
    </UPageCard>
  </div>
</template>
