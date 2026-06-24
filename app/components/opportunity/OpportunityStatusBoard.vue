<script setup lang="ts">
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_DESCRIPTION,
  OPPORTUNITY_STATUS_LABEL,
  type OpportunityStatus,
} from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

/**
 * S7 — Three-column board showing opportunities grouped by review status:
 * Pending / Accepted / Rejected. Click a card to open the form modal.
 *
 * OM-03 — drag a card to another column to request a status transition. The
 * page captures the (required-on-reject) comment and persists via moveStatus,
 * which logs the transition. Dragging is gated on `canDrag` (proposal:update).
 */
interface Props {
  grouped: Record<OpportunityStatus, Opportunity[]>
  canDrag?: boolean
}
const props = withDefaults(defineProps<Props>(), { canDrag: false })
const emit = defineEmits<{
  selectOpportunity: [opp: Opportunity]
  move: [opp: Opportunity, toStatus: OpportunityStatus]
}>()

const dragging = ref<Opportunity | null>(null)
const dragOver = ref<OpportunityStatus | null>(null)

// Cap each column so a busy pipeline doesn't render hundreds of cards at once.
// "Show more" reveals another batch; "Show less" collapses back.
const COLUMN_PAGE = 6
const shown = reactive<Record<string, number>>({})
function visibleCount(s: OpportunityStatus): number {
  return shown[s] ?? COLUMN_PAGE
}
function visibleCards(s: OpportunityStatus): Opportunity[] {
  return (props.grouped[s] ?? []).slice(0, visibleCount(s))
}
function showMore(s: OpportunityStatus) {
  shown[s] = visibleCount(s) + COLUMN_PAGE
}
function showLess(s: OpportunityStatus) {
  shown[s] = COLUMN_PAGE
}

function onDragStart(opp: Opportunity, e: DragEvent) {
  if (!props.canDrag) return
  dragging.value = opp
  e.dataTransfer?.setData('text/plain', opp.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragEnd() {
  dragging.value = null
  dragOver.value = null
}
function onDrop(toStatus: OpportunityStatus) {
  const opp = dragging.value
  dragOver.value = null
  dragging.value = null
  if (!opp || opp.status === toStatus) return
  emit('move', opp, toStatus)
}

function statusColor(s: OpportunityStatus): 'warning' | 'success' | 'error' {
  return s === 'pending' ? 'warning' : s === 'accepted' ? 'success' : 'error'
}
function statusBorder(s: OpportunityStatus): string {
  return s === 'pending'
    ? 'border-warning/40'
    : s === 'accepted'
      ? 'border-success/40'
      : 'border-error/40'
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <section
      v-for="s in OPPORTUNITY_STATUSES"
      :key="s"
      :class="[
        'flex max-h-[calc(100dvh-16rem)] flex-col overflow-hidden rounded-xl border bg-default/40 transition-colors',
        statusBorder(s),
        canDrag && dragOver === s && dragging?.status !== s
          ? 'bg-primary/5 ring-2 ring-primary/40'
          : '',
      ]"
      @dragover.prevent="canDrag && (dragOver = s)"
      @dragleave="dragOver === s && (dragOver = null)"
      @drop.prevent="onDrop(s)"
    >
      <header class="shrink-0 border-b border-default/60 px-3 py-2.5">
        <div class="flex items-center gap-2">
          <UBadge variant="subtle" :color="statusColor(s)" size="sm">
            {{ OPPORTUNITY_STATUS_LABEL[s] }}
          </UBadge>
          <span class="text-xs font-medium text-muted">{{ grouped[s].length }}</span>
        </div>
        <p class="mt-1 text-xs text-muted">{{ OPPORTUNITY_STATUS_DESCRIPTION[s] }}</p>
      </header>

      <div
        v-if="!grouped[s].length"
        class="m-3 flex flex-1 items-center justify-center rounded-lg border border-dashed border-default p-6 text-center text-xs text-muted"
      >
        {{ canDrag && dragging ? 'Drop here' : 'Nothing here yet.' }}
      </div>

      <ul v-else class="flex-1 space-y-2 overflow-y-auto p-3">
        <li
          v-for="opp in visibleCards(s)"
          :key="opp.id"
          :draggable="canDrag"
          :class="[
            canDrag ? 'cursor-grab active:cursor-grabbing' : '',
            dragging?.id === opp.id ? 'opacity-50' : '',
          ]"
          @dragstart="onDragStart(opp, $event)"
          @dragend="onDragEnd"
          @click="emit('selectOpportunity', opp)"
        >
          <OpportunityCard :opportunity="opp" />
        </li>
      </ul>

      <!-- Show more / less — keeps busy columns light -->
      <div
        v-if="(grouped[s]?.length ?? 0) > COLUMN_PAGE"
        class="flex shrink-0 items-center justify-center gap-2 border-t border-default/60 p-2"
      >
        <UButton
          v-if="visibleCount(s) < (grouped[s]?.length ?? 0)"
          size="xs"
          variant="ghost"
          color="neutral"
          :label="`Show more (${(grouped[s]?.length ?? 0) - visibleCount(s)})`"
          icon="i-lucide-chevron-down"
          @click="showMore(s)"
        />
        <UButton
          v-if="visibleCount(s) > COLUMN_PAGE"
          size="xs"
          variant="ghost"
          color="neutral"
          label="Show less"
          icon="i-lucide-chevron-up"
          @click="showLess(s)"
        />
      </div>
    </section>
  </div>
</template>
