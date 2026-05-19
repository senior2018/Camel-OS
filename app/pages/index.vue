<script setup lang="ts">
// Internal-only platform — `/` simply hands off to login or dashboard.
// The global auth middleware redirects authenticated users to /dashboard
// and unauthenticated users to /login, so this page never actually renders.
definePageMeta({
  layout: false,
})
</script>

<template>
  <div />
</template>
