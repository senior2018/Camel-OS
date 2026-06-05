<script setup lang="ts">
import type { CreateOpportunityPayload, OpportunityStatus } from '@@/shared/schemas/opportunity'
import { OPPORTUNITY_STATUSES } from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'
import type { OpportunityFilterState } from '@/components/opportunity/OpportunityFilters.vue'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Opportunities — Camel OS' })

const { can } = await usePermissions()

if (!can.value('opportunity', 'read')) {
  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have permission to view opportunities.',
    fatal: true,
  })
}

const canCreate = computed(() => can.value('opportunity', 'create'))
const canUpdate = computed(() => can.value('opportunity', 'update'))
const canDelete = computed(() => can.value('opportunity', 'delete'))

const {
  data,
  status,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  moveStatus,
  setApproved,
} = useOpportunities()

// ─── Filters + view toggle ─────────────────────────────────────────────────────
const view = ref<'board' | 'list' | 'dashboard'>('board')
const showFilters = ref(false)

const filters = ref<OpportunityFilterState>({
  search: '',
  sources: [],
  types: [],
  statuses: [],
  tag: '',
  deadlineFrom: '',
  deadlineTo: '',
  valueMin: null,
  valueMax: null,
})

function matchesFilters(opp: Opportunity, f: OpportunityFilterState): boolean {
  if (f.statuses.length && !f.statuses.includes(opp.status)) return false
  if (f.sources.length && !f.sources.includes(opp.source)) return false
  if (f.types.length && !f.types.includes(opp.type)) return false

  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase()
    const inTitle = opp.title.toLowerCase().includes(q)
    const inDesc = (opp.description ?? '').toLowerCase().includes(q)
    if (!inTitle && !inDesc) return false
  }

  if (f.tag.trim()) {
    const q = f.tag.trim().toLowerCase()
    if (!opp.tags?.some((t) => t.toLowerCase().includes(q))) return false
  }

  if (f.deadlineFrom && (!opp.deadline || opp.deadline < f.deadlineFrom)) return false
  if (f.deadlineTo && (!opp.deadline || opp.deadline > f.deadlineTo)) return false

  if (f.valueMin !== null || f.valueMax !== null) {
    const v = opp.estimatedValue ? Number(opp.estimatedValue) : null
    if (v === null || Number.isNaN(v)) return false
    if (f.valueMin !== null && v < f.valueMin) return false
    if (f.valueMax !== null && v > f.valueMax) return false
  }

  return true
}

const filteredItems = computed<Opportunity[]>(() => {
  if (!data.value?.items) return []
  return data.value.items.filter((opp) => matchesFilters(opp, filters.value))
})

const filteredGroupedByStatus = computed<Record<OpportunityStatus, Opportunity[]>>(() => {
  const grouped = Object.fromEntries(
    OPPORTUNITY_STATUSES.map((s) => [s, [] as Opportunity[]])
  ) as Record<OpportunityStatus, Opportunity[]>
  for (const opp of filteredItems.value) grouped[opp.status].push(opp)
  return grouped
})

// ─── Modal state ───────────────────────────────────────────────────────────────
const showFormModal = ref(false)
const editing = ref<Opportunity | null>(null)
const submitting = ref(false)

function openCreate() {
  editing.value = null
  showFormModal.value = true
}

function openEdit(opp: Opportunity) {
  editing.value = opp
  showFormModal.value = true
}

const toast = useToast()

async function uploadPendingFiles(opportunityId: string, files: File[]): Promise<void> {
  for (const file of files) {
    try {
      const body = new FormData()
      body.append('file', file)
      await $fetch(`/api/opportunities/${opportunityId}/attachments`, {
        method: 'POST',
        body,
      })
    } catch (err) {
      const msg =
        (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Upload failed'
      toast.add({
        title: `Couldn't upload ${file.name}`,
        description: `${msg}. You can retry from the opportunity's edit screen.`,
        color: 'error',
      })
    }
  }
}

async function handleSubmit(
  payload: CreateOpportunityPayload,
  id: string | null,
  pendingFiles: File[]
) {
  if (id ? !canUpdate.value : !canCreate.value) return
  submitting.value = true
  let ok: boolean
  if (id) {
    ok = await updateOpportunity(id, payload)
  } else {
    const created = await createOpportunity(payload)
    ok = !!created
    if (created && pendingFiles.length) {
      await uploadPendingFiles(created.id, pendingFiles)
    }
  }
  submitting.value = false
  if (ok) showFormModal.value = false
}

const confirmDelete = ref<Opportunity | null>(null)
async function confirmAndDelete() {
  if (!confirmDelete.value) return
  const opp = confirmDelete.value
  confirmDelete.value = null
  await deleteOpportunity(opp)
}

const totalCount = computed(() => data.value?.items?.length ?? 0)
const filteredCount = computed(() => filteredItems.value.length)
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Opportunities</h1>
        <p class="mt-1 text-sm text-muted">
          Review pipeline — Pending → Accepted → Rejected. Accepted opportunities spawn a proposal
          in the Proposals module.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UFieldGroup>
          <UButton
            :color="view === 'board' ? 'primary' : 'neutral'"
            :variant="view === 'board' ? 'solid' : 'outline'"
            icon="i-lucide-columns-3"
            aria-label="Board view"
            @click="view = 'board'"
          >
            <span class="hidden sm:inline">Board</span>
          </UButton>
          <UButton
            :color="view === 'list' ? 'primary' : 'neutral'"
            :variant="view === 'list' ? 'solid' : 'outline'"
            icon="i-lucide-list"
            aria-label="List view"
            @click="view = 'list'"
          >
            <span class="hidden sm:inline">List</span>
          </UButton>
          <UButton
            :color="view === 'dashboard' ? 'primary' : 'neutral'"
            :variant="view === 'dashboard' ? 'solid' : 'outline'"
            icon="i-lucide-bar-chart-3"
            aria-label="Dashboard view"
            @click="view = 'dashboard'"
          >
            <span class="hidden sm:inline">Dashboard</span>
          </UButton>
        </UFieldGroup>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-filter"
          :aria-label="showFilters ? 'Hide filters' : 'Show filters'"
          @click="showFilters = !showFilters"
        >
          <span class="hidden sm:inline">{{ showFilters ? 'Hide filters' : 'Filters' }}</span>
        </UButton>
        <UButton
          v-if="canCreate"
          size="md"
          icon="i-lucide-plus"
          class="ml-auto"
          @click="openCreate"
        >
          <span class="hidden sm:inline">New opportunity</span>
          <span class="sm:hidden">New</span>
        </UButton>
      </div>
    </header>

    <OpportunityFilters v-if="showFilters" v-model="filters" />

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else>
      <div
        v-if="totalCount === 0"
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
      >
        <UIcon name="i-lucide-target" class="size-10 text-muted" />
        <h2 class="text-lg font-semibold text-default">No opportunities yet</h2>
        <p class="max-w-md text-sm text-muted">
          Add your first opportunity to start tracking your review pipeline.
        </p>
        <UButton
          v-if="canCreate"
          size="lg"
          icon="i-lucide-plus"
          label="New opportunity"
          @click="openCreate"
        />
      </div>

      <div
        v-else-if="filteredCount === 0"
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
      >
        <UIcon name="i-lucide-filter-x" class="size-10 text-muted" />
        <h2 class="text-lg font-semibold text-default">No matches</h2>
        <p class="text-sm text-muted">Adjust your filters to see opportunities.</p>
      </div>

      <template v-else>
        <p class="text-xs text-muted">Showing {{ filteredCount }} of {{ totalCount }}</p>

        <OpportunityStatusBoard
          v-if="view === 'board'"
          :grouped="filteredGroupedByStatus"
          @select-opportunity="openEdit"
        />

        <OpportunityList
          v-else-if="view === 'list'"
          :items="filteredItems"
          @select-opportunity="openEdit"
        />

        <OpportunityDashboard v-else :items="filteredItems" @select-opportunity="openEdit" />
      </template>
    </template>

    <OpportunityFormModal
      v-model:open="showFormModal"
      :initial="editing"
      :submitting="submitting"
      :can-delete="canDelete"
      :read-only="!!editing && !canUpdate"
      @submit="handleSubmit"
      @delete="
        (opp) => {
          showFormModal = false
          confirmDelete = opp
        }
      "
      @approve="
        async (opp, approved) => {
          if (!canUpdate) return
          await setApproved(opp, approved)
          showFormModal = false
        }
      "
      @move-status="
        async (opp, toStatus, comment) => {
          if (!canUpdate) return
          const ok = await moveStatus(opp, toStatus, comment)
          if (ok) {
            editing = { ...opp, status: toStatus }
          }
        }
      "
    />

    <UModal
      :open="!!confirmDelete"
      title="Delete opportunity?"
      @update:open="!$event && (confirmDelete = null)"
    >
      <template #body>
        <p class="text-sm text-muted">
          This will permanently delete
          <span class="font-medium text-default">{{ confirmDelete?.title }}</span
          >. This cannot be undone.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" label="Cancel" @click="confirmDelete = null" />
          <UButton v-if="canDelete" color="error" label="Delete" @click="confirmAndDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
