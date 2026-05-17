<script setup lang="ts">
interface Props {
  variant?: 'full' | 'mark'
}

withDefaults(defineProps<Props>(), { variant: 'full' })
</script>

<template>
  <div class="flex items-center gap-2.5">
    <NuxtImg
      src="/logo.png"
      alt="Sahara Consult"
      width="40"
      height="40"
      class="size-9 rounded-lg shrink-0"
    />
    <span
      v-if="variant === 'full'"
      class="text-base font-semibold tracking-tight text-default"
    >
      Sahara <span class="text-primary">Consult</span>
    </span>
  </div>
</template>
