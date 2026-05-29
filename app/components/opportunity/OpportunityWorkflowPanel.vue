<script setup lang="ts">
import { OPPORTUNITY_STAGE_LABEL, type OpportunityStage } from '@@/shared/schemas/opportunity'

/**
 * Stage-aware workflow panel rendered inside the opportunity edit modal.
 * Shows the current stage's activity checklist + the full transition history.
 * The user ticks items off as they complete them; the parent reloads after.
 */
interface Activity {
  id: string
  stage: OpportunityStage
  label: string
  completedAt: string | null
  completedByUserId: string | null
  sortOrder: number
}

interface Transition {
  id: string
  fromStage: OpportunityStage
  toStage: OpportunityStage
  comment: string | null
  createdAt: string
  userFirstName: string | null
  userLastName: string | null
  userEmail: string | null
}

interface WorkflowBundle {
  stage: OpportunityStage
  activities: Activity[]
  transitions: Transition[]
}

interface Props {
  opportunityId: string
  canEdit: boolean
}

const props = defineProps<Props>()

const toast = useToast()
const opportunityIdRef = computed(() => props.opportunityId)
const data = ref<WorkflowBundle | null>(null)
const loading = ref(false)
const newLabel = ref('')

async function refresh() {
  loading.value = true
  try {
    data.value = await $fetch<WorkflowBundle>(
      `/api/opportunities/${opportunityIdRef.value}/workflow`
    )
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
}

watch(opportunityIdRef, refresh, { immediate: true })

const completed = computed(() => data.value?.activities.filter((a) => a.completedAt).length ?? 0)
const total = computed(() => data.value?.activities.length ?? 0)
const progress = computed(() =>
  total.value ? Math.round((completed.value / total.value) * 100) : 0
)

async function toggle(a: Activity) {
  if (!props.canEdit) return
  try {
    await $fetch(`/api/opportunities/${opportunityIdRef.value}/activities/${a.id}`, {
      method: 'PATCH',
      body: { completed: !a.completedAt },
    })
    await refresh()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Update failed.'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  }
}

async function addCustom() {
  if (!newLabel.value.trim() || !props.canEdit) return
  try {
    await $fetch(`/api/opportunities/${opportunityIdRef.value}/activities`, {
      method: 'POST',
      body: { label: newLabel.value.trim() },
    })
    newLabel.value = ''
    await refresh()
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Add failed.'
    toast.add({ title: 'Could not add', description: msg, color: 'error' })
  }
}

async function removeActivity(a: Activity) {
  if (!props.canEdit) return
  try {
    await $fetch(`/api/opportunities/${opportunityIdRef.value}/activities/${a.id}`, {
      method: 'DELETE',
    })
    await refresh()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Delete failed.'
    toast.add({ title: 'Could not remove', description: msg, color: 'error' })
  }
}

function authorLabel(t: Transition): string {
  return [t.userFirstName, t.userLastName].filter(Boolean).join(' ') || t.userEmail || 'System'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Stage activities -->
    <div class="rounded-lg border border-default p-4">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-wide text-muted">Current stage</p>
          <p class="text-sm font-semibold text-default">
            {{ data ? OPPORTUNITY_STAGE_LABEL[data.stage] : '…' }}
          </p>
        </div>
        <UBadge
          v-if="total > 0"
          variant="subtle"
          :color="progress === 100 ? 'success' : 'primary'"
          size="sm"
          :label="`${completed}/${total} done`"
        />
      </div>

      <div v-if="loading && !data" class="py-4 text-center text-sm text-muted">Loading…</div>

      <ul v-else-if="data?.activities.length" class="space-y-2">
        <li
          v-for="a in data.activities"
          :key="a.id"
          class="flex items-start gap-3 rounded-md border border-default bg-default p-2"
        >
          <UCheckbox
            :model-value="!!a.completedAt"
            :disabled="!canEdit"
            @update:model-value="toggle(a)"
          />
          <div class="min-w-0 flex-1">
            <p :class="['text-sm', a.completedAt ? 'text-muted line-through' : 'text-default']">
              {{ a.label }}
            </p>
            <p v-if="a.completedAt" class="text-xs text-muted">
              Done {{ formatDate(a.completedAt) }}
            </p>
          </div>
          <UButton
            v-if="canEdit"
            size="xs"
            variant="ghost"
            color="error"
            icon="i-lucide-x"
            aria-label="Remove"
            @click="removeActivity(a)"
          />
        </li>
      </ul>

      <p v-else class="py-3 text-center text-sm text-muted">
        No activities defined for this stage.
      </p>

      <div v-if="canEdit" class="mt-3 flex items-center gap-2">
        <UInput
          v-model="newLabel"
          size="sm"
          placeholder="Add a custom step…"
          class="flex-1"
          @keyup.enter="addCustom"
        />
        <UButton size="xs" variant="outline" icon="i-lucide-plus" label="Add" @click="addCustom" />
      </div>
    </div>

    <!-- Stage history -->
    <div v-if="data?.transitions.length" class="rounded-lg border border-default p-4">
      <p class="mb-3 text-xs uppercase tracking-wide text-muted">Stage history</p>
      <ol class="space-y-2 text-sm">
        <li v-for="t in data.transitions" :key="t.id" class="text-default">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge variant="subtle" color="neutral" size="xs">
              {{ OPPORTUNITY_STAGE_LABEL[t.fromStage] }}
            </UBadge>
            <UIcon name="i-lucide-arrow-right" class="size-3.5 text-muted" />
            <UBadge variant="subtle" color="primary" size="xs">
              {{ OPPORTUNITY_STAGE_LABEL[t.toStage] }}
            </UBadge>
            <span class="text-xs text-muted">
              {{ formatDate(t.createdAt) }} · {{ authorLabel(t) }}
            </span>
          </div>
          <p v-if="t.comment" class="mt-1 whitespace-pre-wrap text-xs text-muted">
            "{{ t.comment }}"
          </p>
        </li>
      </ol>
    </div>
  </div>
</template>
