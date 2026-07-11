<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
const { user } = useUserSession()
const uid = (user.value as { id?: string } | null)?.id
if (uid) await navigateTo(`/experts/${uid}`, { replace: true })
</script>

<template>
  <div class="flex justify-center py-20">
    <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
  </div>
</template>
