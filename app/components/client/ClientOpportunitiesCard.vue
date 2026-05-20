<script setup lang="ts">
import { OPPORTUNITY_STAGE_LABEL } from '@@/shared/schemas/opportunity'
import type { ClientLinkedOpportunity } from '@/composables/useClient'

interface Props {
  linked: ClientLinkedOpportunity[]
  /** Pool of unlinked opportunities to pick from when linking. */
  available: Array<{ id: string; title: string }>
  canEdit: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  link: [opportunityId: string, isPrimary: boolean]
  unlink: [opportunityId: string]
}>()

const showPicker = ref(false)
const pick = ref<string | undefined>(undefined)
const asPrimary = ref(false)

const totalValue = computed(() => {
  return props.linked.reduce((acc, o) => {
    if (!o.estimatedValue) return acc
    const n = Number(o.estimatedValue)
    return Number.isNaN(n) ? acc : acc + n
  }, 0)
})

const valueByCurrency = computed(() => {
  const byCcy: Record<string, number> = {}
  for (const o of props.linked) {
    if (!o.estimatedValue) continue
    const n = Number(o.estimatedValue)
    if (Number.isNaN(n)) continue
    byCcy[o.currency] = (byCcy[o.currency] ?? 0) + n
  }
  return byCcy
})

const availableOptions = computed(() =>
  props.available.map((o) => ({ label: o.title, value: o.id }))
)

function openPicker() {
  pick.value = undefined
  asPrimary.value = props.linked.length === 0
  showPicker.value = true
}

function confirmLink() {
  if (!pick.value) return
  emit('link', pick.value, asPrimary.value)
  showPicker.value = false
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-default">Linked opportunities</h3>
          <p v-if="linked.length" class="mt-0.5 text-xs text-muted">
            {{ linked.length }} linked · total
            <span
              v-for="(amt, ccy, i) in valueByCurrency"
              :key="ccy"
              class="font-medium text-default"
            >
              <span v-if="i > 0">, </span>{{ formatMoney(amt, ccy) }}
            </span>
            <span v-if="!totalValue" class="text-muted">—</span>
          </p>
        </div>
        <UButton
          v-if="canEdit && available.length"
          size="xs"
          variant="outline"
          icon="i-lucide-link"
          label="Link"
          @click="openPicker"
        />
      </div>
    </template>

    <div
      v-if="!linked.length"
      class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      No opportunities linked yet.
    </div>

    <ul v-else class="divide-y divide-default">
      <li v-for="o in linked" :key="o.opportunityId" class="flex items-center gap-3 py-3">
        <NuxtLink
          :to="`/opportunities`"
          class="min-w-0 flex-1 text-sm font-medium text-default hover:text-primary"
        >
          {{ o.title }}
        </NuxtLink>
        <UBadge
          variant="subtle"
          color="neutral"
          size="xs"
          :label="OPPORTUNITY_STAGE_LABEL[o.stage]"
        />
        <UBadge v-if="o.isPrimary" variant="subtle" color="primary" size="xs" label="Primary" />
        <span v-if="o.estimatedValue" class="text-xs text-muted">
          {{ formatMoney(Number(o.estimatedValue), o.currency) }}
        </span>
        <UButton
          v-if="canEdit"
          size="xs"
          variant="ghost"
          color="error"
          icon="i-lucide-unlink"
          aria-label="Unlink"
          @click="emit('unlink', o.opportunityId)"
        />
      </li>
    </ul>

    <UModal v-model:open="showPicker" title="Link an opportunity">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Opportunity" required>
            <USelectMenu
              v-model="pick"
              :items="availableOptions"
              value-key="value"
              placeholder="Choose…"
              class="w-full"
            />
          </UFormField>
          <UCheckbox v-model="asPrimary" label="Make this the primary client for the opportunity" />
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showPicker = false" />
          <UButton :disabled="!pick" label="Link" @click="confirmLink" />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
