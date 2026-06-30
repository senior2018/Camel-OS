<script setup lang="ts">
import { STRATEGY_RAG_HEX, type StrategyStatus } from '@@/shared/schemas/strategy'

const props = withDefaults(
  defineProps<{
    progress: number
    status: StrategyStatus
    size?: number
    stroke?: number
    label?: boolean
  }>(),
  { size: 64, stroke: 6, label: true }
)
const radius = computed(() => (props.size - props.stroke) / 2)
const circ = computed(() => 2 * Math.PI * radius.value)
const dash = computed(() => (Math.max(0, Math.min(100, props.progress)) / 100) * circ.value)
const color = computed(() => STRATEGY_RAG_HEX[props.status])
</script>

<template>
  <div
    class="relative inline-flex items-center justify-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg :width="size" :height="size" class="-rotate-90">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="currentColor"
        :stroke-width="stroke"
        class="text-elevated"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="`${dash} ${circ}`"
        class="transition-all duration-500"
      />
    </svg>
    <span v-if="label" class="absolute text-sm font-semibold text-default"
      >{{ Math.round(progress) }}%</span
    >
  </div>
</template>
