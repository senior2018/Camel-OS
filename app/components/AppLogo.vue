<script setup lang="ts">
interface Props {
  variant?: 'full' | 'mark'
}

withDefaults(defineProps<Props>(), { variant: 'full' })
</script>

<template>
  <div class="flex items-center gap-2.5">
    <img src="/logo.png" alt="Camel OS" width="40" height="40" class="size-9 rounded-lg shrink-0" />
    <span v-if="variant === 'full'" class="text-base font-semibold tracking-tight text-default">
      Camel <span class="text-primary">OS</span>
    </span>
  </div>
</template>
