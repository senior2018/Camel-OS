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

const STAGE_ICON: Record<OpportunityStage, string> = {
  discovery: 'i-lucide-radar',
  qualifying: 'i-lucide-search-check',
  proposal: 'i-lucide-file-text',
  submitted: 'i-lucide-send',
  won: 'i-lucide-trophy',
  lost: 'i-lucide-x-circle',
}

const selectedStage = ref<OpportunityStage>('discovery')

const stageList = computed(() =>
  OPPORTUNITY_STAGES.map((stage) => ({
    key: stage,
    label: OPPORTUNITY_STAGE_LABEL[stage],
    icon: STAGE_ICON[stage],
    count: props.grouped[stage]?.length ?? 0,
  }))
)

const selectedItems = computed<Opportunity[]>(() => props.grouped[selectedStage.value] ?? [])

// Same pointerdown/pointerup pattern as Kanban — HTML5 draggable elements
// suppress synthetic clicks, so we synthesize one from movement deltas.
const CLICK_THRESHOLD_PX = 5
let pointerDownPos: { x: number; y: number } | null = null
let lastDragEndAt = 0
const dragOverStage = ref<OpportunityStage | null>(null)

function onPointerDown(event: PointerEvent) {
  pointerDownPos = { x: event.clientX, y: event.clientY }
}

function onPointerUp(opp: Opportunity, event: PointerEvent) {
  const start = pointerDownPos
  pointerDownPos = null
  if (!start) return
  const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
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

function onStageDragOver(stage: OpportunityStage, event: DragEvent) {
  if (!props.canMove) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverStage.value = stage
}

function onStageDragLeave(stage: OpportunityStage) {
  if (dragOverStage.value === stage) dragOverStage.value = null
}

function onStageDrop(stage: OpportunityStage, event: DragEvent) {
  if (!props.canMove) return
  event.preventDefault()
  dragOverStage.value = null
  const oppId = event.dataTransfer?.getData('application/x-camel-opportunity')
  if (!oppId) return
  if (stage === selectedStage.value) return
  const opp = selectedItems.value.find((o) => o.id === oppId)
  if (opp) emit('moveStage', opp, stage)
}
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:gap-4">
    <!-- Stages rail. Vertical on sm+, horizontal scrollable pills on mobile. -->
    <nav
      class="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-56 sm:flex-col sm:overflow-visible sm:pb-0"
      aria-label="Opportunity stages"
    >
      <button
        v-for="s in stageList"
        :key="s.key"
        type="button"
        class="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors sm:w-full"
        :class="[
          selectedStage === s.key
            ? 'border-primary/40 bg-primary/10 text-primary font-medium'
            : 'border-default bg-default text-default hover:bg-elevated/60',
          dragOverStage === s.key ? 'border-primary ring-2 ring-primary/40' : '',
        ]"
        @click="selectedStage = s.key"
        @dragover="onStageDragOver(s.key, $event)"
        @dragleave="onStageDragLeave(s.key)"
        @drop="onStageDrop(s.key, $event)"
      >
        <UIcon :name="s.icon" class="size-4 shrink-0" />
        <span class="flex-1 truncate">{{ s.label }}</span>
        <UBadge variant="subtle" :color="selectedStage === s.key ? 'primary' : 'neutral'" size="xs">
          {{ s.count }}
        </UBadge>
      </button>
    </nav>

    <!-- Selected-stage opportunities. -->
    <div class="min-w-0 flex-1">
      <div
        v-if="!selectedItems.length"
        class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
      >
        No opportunity in this stage.
      </div>

      <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="opp in selectedItems"
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
      </div>
    </div>
  </div>
</template>
