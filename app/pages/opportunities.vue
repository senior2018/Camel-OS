<script setup lang="ts">
import type { CreateOpportunityPayload, OpportunityStage } from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

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

const { data, status, createOpportunity, updateOpportunity, deleteOpportunity, moveStage } =
  useOpportunities()

const showFormModal = ref(false)
const editing = ref<Opportunity | null>(null)
const submitting = ref(false)

function openCreate() {
  editing.value = null
  showFormModal.value = true
}

function openEdit(opp: Opportunity) {
  // Anyone with `opportunity:read` can open the modal — it falls back to
  // read-only when the viewer lacks update permission.
  editing.value = opp
  showFormModal.value = true
}

async function handleSubmit(payload: CreateOpportunityPayload, id: string | null) {
  // Defence-in-depth: hidden buttons aren't a real auth check. The server will
  // also reject this via `requirePermission`, but skipping the call client-side
  // avoids a wasted round-trip and a generic 403 toast.
  if (id ? !canUpdate.value : !canCreate.value) return
  submitting.value = true
  const ok = id ? await updateOpportunity(id, payload) : await createOpportunity(payload)
  submitting.value = false
  if (ok) showFormModal.value = false
}

async function handleMove(opp: Opportunity, toStage: OpportunityStage) {
  if (!canUpdate.value) return
  await moveStage(opp, toStage)
}

const confirmDelete = ref<Opportunity | null>(null)
async function confirmAndDelete() {
  if (!confirmDelete.value) return
  const opp = confirmDelete.value
  confirmDelete.value = null
  await deleteOpportunity(opp)
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Opportunities</h1>
        <p class="mt-1 text-sm text-muted">
          Track tenders, grants, and partnership leads through the pipeline.
        </p>
      </div>
      <UButton
        v-if="canCreate"
        size="lg"
        icon="i-lucide-plus"
        label="New opportunity"
        @click="openCreate"
      />
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else>
      <div
        v-if="!data?.items?.length"
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
      >
        <UIcon name="i-lucide-target" class="size-10 text-muted" />
        <h2 class="text-lg font-semibold text-default">No opportunities yet</h2>
        <p class="max-w-md text-sm text-muted">
          Add your first opportunity to start tracking your pipeline.
        </p>
        <UButton
          v-if="canCreate"
          size="lg"
          icon="i-lucide-plus"
          label="New opportunity"
          @click="openCreate"
        />
      </div>

      <OpportunityKanban
        v-else
        :grouped="data.grouped"
        :can-move="canUpdate"
        @select-opportunity="openEdit"
        @move-stage="handleMove"
      />
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
