<script setup lang="ts">
definePageMeta({
  layout: false,
})

const { user, clear } = useUserSession()

async function logout() {
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12">
    <UCard class="w-full max-w-2xl">
      <template #header>
        <div class="space-y-2">
          <h1 class="text-2xl font-semibold">Dashboard</h1>
          <p class="text-sm text-muted">You are signed in as {{ user?.email }}.</p>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          This is the protected area for your app. You can build your workspace experience here
          next.
        </p>

        <UButton color="neutral" variant="soft" label="Logout" @click="logout" />
      </div>
    </UCard>
  </div>
</template>
