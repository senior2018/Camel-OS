<script setup lang="ts">
import type { CreateOpportunityPayload, OpportunityStatus } from '@@/shared/schemas/opportunity'
import { OPPORTUNITY_STATUSES, OPPORTUNITY_STATUS_LABEL } from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'
import type { OpportunityFilterState } from '@/components/opportunity/OpportunityFilters.vue'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Opportunities — Camel OS' })

const { can, isAdmin } = await usePermissions()

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
// OM-08 — Accept/Reject (Go/No-Go) is a managerial action, separate from edit.
const canApprove = computed(() => can.value('opportunity', 'approve'))

// Record-level edit rule (mirrors the server guard): only the owner, the
// creator, or an admin may edit/delete an opportunity. Anyone with
// opportunity:update can still change its status (review pipeline).
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)
function canEditOpp(opp: Opportunity): boolean {
  if (isAdmin.value) return true
  if (!canUpdate.value) return false
  return opp.ownerUserId === currentUserId.value || opp.createdByUserId === currentUserId.value
}

const { data, status, createOpportunity, updateOpportunity, deleteOpportunity, moveStatus } =
  useOpportunities()

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

// ─── OM-03 drag-and-drop status transitions ────────────────────────────────────
const pendingMove = ref<{ opp: Opportunity; toStatus: OpportunityStatus } | null>(null)
const moveComment = ref('')
const movingStatus = ref(false)
const moveRequiresComment = computed(() => pendingMove.value?.toStatus === 'rejected')

function requestMove(opp: Opportunity, toStatus: OpportunityStatus) {
  if (!canApprove.value) return
  moveComment.value = ''
  pendingMove.value = { opp, toStatus }
}
async function confirmMove() {
  if (!pendingMove.value) return
  if (moveRequiresComment.value && !moveComment.value.trim()) return
  movingStatus.value = true
  const { opp, toStatus } = pendingMove.value
  const ok = await moveStatus(opp, toStatus, moveComment.value.trim() || null)
  movingStatus.value = false
  if (ok) pendingMove.value = null
}

const totalCount = computed(() => data.value?.total ?? data.value?.items?.length ?? 0)
const capped = computed(() => data.value?.capped ?? false)
const filteredCount = computed(() => filteredItems.value.length)

// Permanent "basic" status filter (advanced filters live in OpportunityFilters).
const statusOptions = OPPORTUNITY_STATUSES.map((s) => ({
  label: OPPORTUNITY_STATUS_LABEL[s],
  value: s,
}))

// List view pagination (board + dashboard intentionally show the full set).
const {
  page: listPage,
  pageSize: listPageSize,
  total: listTotal,
  items: pagedListItems,
} = usePagination(filteredItems, 15)
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Opportunities</h1>
        <p class="mt-1 text-sm text-muted">
          Review pipeline — Pending → Accepted → Rejected. Accepted opportunities spawn a proposal
          in the Proposals module.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UFieldGroup>
          <UButton
            :color="view === 'board' ? 'primary' : 'neutral'"
            :variant="view === 'board' ? 'solid' : 'outline'"
            icon="i-lucide-columns-3"
            label="Board"
            @click="view = 'board'"
          />
          <UButton
            :color="view === 'list' ? 'primary' : 'neutral'"
            :variant="view === 'list' ? 'solid' : 'outline'"
            icon="i-lucide-list"
            label="List"
            @click="view = 'list'"
          />
          <UButton
            :color="view === 'dashboard' ? 'primary' : 'neutral'"
            :variant="view === 'dashboard' ? 'solid' : 'outline'"
            icon="i-lucide-bar-chart-3"
            label="Dashboard"
            @click="view = 'dashboard'"
          />
        </UFieldGroup>
        <UButton v-if="canCreate" icon="i-lucide-plus" @click="openCreate">
          <span class="hidden sm:inline">New opportunity</span>
          <span class="sm:hidden">New</span>
        </UButton>
      </div>
    </header>

    <!-- Filter bar — search + status, with advanced filters behind "More filters". -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <UInput
        v-model="filters.search"
        icon="i-lucide-search"
        placeholder="Search opportunities by title…"
        size="md"
        class="w-full sm:max-w-md"
      />
      <USelectMenu
        v-model="filters.statuses"
        :items="statusOptions"
        value-key="value"
        multiple
        placeholder="Any status"
        size="md"
        class="w-full sm:w-56"
      />
      <UButton
        variant="ghost"
        color="neutral"
        :icon="showFilters ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
        :aria-label="showFilters ? 'Hide advanced filters' : 'Show advanced filters'"
        @click="showFilters = !showFilters"
      >
        <span class="hidden sm:inline">{{ showFilters ? 'Less' : 'More filters' }}</span>
      </UButton>
    </div>

    <OpportunityFilters v-if="showFilters" v-model="filters" />

    <UAlert
      v-if="capped"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Showing the most recent 500"
      :description="`This view is capped for performance (${totalCount} total). Narrow with filters to find older opportunities.`"
    />

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
          :can-drag="canApprove"
          @select-opportunity="openEdit"
          @move="requestMove"
        />

        <template v-else-if="view === 'list'">
          <OpportunityList :items="pagedListItems" @select-opportunity="openEdit" />
          <AppPagination
            v-model:page="listPage"
            :total="listTotal"
            :page-size="listPageSize"
            class="mt-4"
          />
        </template>

        <OpportunityDashboard v-else :items="filteredItems" @select-opportunity="openEdit" />
      </template>
    </template>

    <OpportunityFormModal
      v-model:open="showFormModal"
      :initial="editing"
      :submitting="submitting"
      :can-delete="canDelete"
      :can-edit="editing ? canEditOpp(editing) : canCreate"
      :can-change-status="canApprove"
      @submit="handleSubmit"
      @delete="
        (opp) => {
          showFormModal = false
          confirmDelete = opp
        }
      "
      @move-status="
        async (opp, toStatus, comment) => {
          if (!canApprove) return
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

    <!-- OM-03 — confirm a drag-and-drop status transition -->
    <UModal
      :open="!!pendingMove"
      title="Change status?"
      @update:open="!$event && (pendingMove = null)"
    >
      <template #body>
        <p class="text-sm text-muted">
          Move
          <span class="font-medium text-default">{{ pendingMove?.opp.title }}</span>
          to
          <span class="font-medium text-default">
            {{ pendingMove ? OPPORTUNITY_STATUS_LABEL[pendingMove.toStatus] : '' }}</span
          >.
          <span v-if="pendingMove?.toStatus === 'accepted'">A proposal will be created.</span>
        </p>
        <UFormField
          class="mt-3"
          :label="moveRequiresComment ? 'Reason (required)' : 'Comment (optional)'"
        >
          <UTextarea
            v-model="moveComment"
            :rows="3"
            class="w-full"
            placeholder="Add context for this transition…"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" label="Cancel" @click="pendingMove = null" />
          <UButton
            label="Confirm"
            :loading="movingStatus"
            :disabled="moveRequiresComment && !moveComment.trim()"
            @click="confirmMove"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
