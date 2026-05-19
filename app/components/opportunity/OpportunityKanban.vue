<script setup lang="ts">
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  type OpportunityStage,
} from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

interface Props {
  grouped: Record<OpportunityStage, Opportunity[]>
  canMove?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  selectOpportunity: [opp: Opportunity]
  moveStage: [opp: Opportunity, toStage: OpportunityStage]
}>()

const stageColumns = computed(() =>
  OPPORTUNITY_STAGES.map((stage) => ({
    key: stage,
    label: OPPORTUNITY_STAGE_LABEL[stage],
    items: props.grouped[stage] ?? [],
  }))
)

const dragOverStage = ref<OpportunityStage | null>(null)

// Track pointer position so we can distinguish a click from the start of a drag.
// Browsers suppress synthetic `click` events on children of draggable elements,
// so we fire our own based on a small movement threshold.
const CLICK_THRESHOLD_PX = 5
let pointerDownPos: { x: number; y: number } | null = null
let lastDragEndAt = 0

function onPointerDown(event: PointerEvent) {
  pointerDownPos = { x: event.clientX, y: event.clientY }
}

function onPointerUp(opp: Opportunity, event: PointerEvent) {
  const start = pointerDownPos
  pointerDownPos = null
  if (!start) return
  const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
  // If the user dropped a drag, the dragend handler will have fired moments ago —
  // ignore the trailing pointerup so we don't open the modal after a drop.
  if (moved > CLICK_THRESHOLD_PX) return
  if (Date.now() - lastDragEndAt < 200) return
  emit('selectOpportunity', opp)
}

function onDragStart(opp: Opportunity, event: DragEvent) {
  if (!props.canMove || !event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-camel-opportunity', opp.id)
}

function onDragEnd() {
  lastDragEndAt = Date.now()
}

function onDragOver(stage: OpportunityStage, event: DragEvent) {
  if (!props.canMove) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverStage.value = stage
}

function onDragLeave(stage: OpportunityStage) {
  if (dragOverStage.value === stage) dragOverStage.value = null
}

function onDrop(stage: OpportunityStage, event: DragEvent) {
  if (!props.canMove) return
  event.preventDefault()
  dragOverStage.value = null
  const oppId = event.dataTransfer?.getData('application/x-camel-opportunity')
  if (!oppId) return
  for (const col of stageColumns.value) {
    const found = col.items.find((o) => o.id === oppId)
    if (found && found.stage !== stage) {
      emit('moveStage', found, stage)
      return
    }
  }
}
</script>

<template>
  <div class="overflow-x-auto pb-4">
    <div class="flex min-w-max gap-4">
      <div
        v-for="col in stageColumns"
        :key="col.key"
        class="flex w-72 shrink-0 flex-col rounded-xl border border-default bg-elevated/30 p-3 transition-colors"
        :class="dragOverStage === col.key ? 'border-primary bg-primary/5' : ''"
        @dragover="onDragOver(col.key, $event)"
        @dragleave="onDragLeave(col.key)"
        @drop="onDrop(col.key, $event)"
      >
        <header class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-default">
            {{ col.label }}
          </h3>
          <UBadge variant="subtle" color="neutral" size="xs">{{ col.items.length }}</UBadge>
        </header>

        <div class="flex flex-col gap-2">
          <div
            v-for="opp in col.items"
            :key="opp.id"
            :draggable="canMove"
            class="cursor-pointer"
            :class="canMove ? 'active:cursor-grabbing' : ''"
            @dragstart="onDragStart(opp, $event)"
            @dragend="onDragEnd"
            @pointerdown="onPointerDown"
            @pointerup="onPointerUp(opp, $event)"
          >
            <OpportunityCard :opportunity="opp" />
          </div>

          <p v-if="!col.items.length" class="py-6 text-center text-xs text-dimmed">
            No opportunities
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
