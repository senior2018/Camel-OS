<script setup lang="ts">
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  type CreateProjectPayload,
  type LinkDonorProjectPayload,
  type ProjectStatus,
  type UpdateDonorProjectPayload,
} from '@@/shared/schemas/project'
import type { DonorFundedProject } from '@/composables/useClient'

interface ProjectOption {
  id: string
  name: string
  code: string | null
  status: ProjectStatus
}

interface Props {
  fundedProjects: DonorFundedProject[]
  canEdit: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  link: [payload: LinkDonorProjectPayload]
  update: [projectId: string, payload: UpdateDonorProjectPayload]
  unlink: [projectId: string]
  'project-created': []
}>()

const toast = useToast()

// Available projects, fetched once. We `refreshNuxtData` after a create so the
// dropdown picks up the new project without a full page reload.
const { data: projectsData, refresh: refreshProjects } = await useFetch<{
  items: Array<{
    id: string
    name: string
    code: string | null
    status: ProjectStatus
    startDate: string | null
    endDate: string | null
  }>
}>('/api/projects', { key: 'projects-list', default: () => ({ items: [] }) })

const availableProjects = computed<ProjectOption[]>(() => {
  const linkedIds = new Set(props.fundedProjects.map((p) => p.projectId))
  return (projectsData.value?.items ?? [])
    .filter((p) => !linkedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, code: p.code, status: p.status }))
})

// Link / edit-funding modal --------------------------------------------------
const showLinkForm = ref(false)
const editingProjectId = ref<string | null>(null)
const linkForm = reactive<{
  projectId: string | undefined
  fundingAmount: string
  currency: string
  notes: string
}>({
  projectId: undefined,
  fundingAmount: '',
  currency: 'USD',
  notes: '',
})

const linkProjectOptions = computed(() =>
  availableProjects.value.map((p) => ({
    label: p.code ? `${p.name} (${p.code})` : p.name,
    value: p.id,
  }))
)

function openLink() {
  editingProjectId.value = null
  Object.assign(linkForm, { projectId: undefined, fundingAmount: '', currency: 'USD', notes: '' })
  showLinkForm.value = true
}

function openEdit(p: DonorFundedProject) {
  editingProjectId.value = p.projectId
  Object.assign(linkForm, {
    projectId: p.projectId,
    fundingAmount: p.fundingAmount ?? '',
    currency: p.currency,
    notes: p.notes ?? '',
  })
  showLinkForm.value = true
}

function submitLink() {
  if (editingProjectId.value) {
    const payload: UpdateDonorProjectPayload = {
      fundingAmount: linkForm.fundingAmount || null,
      currency: linkForm.currency,
      notes: linkForm.notes || null,
    }
    emit('update', editingProjectId.value, payload)
  } else {
    if (!linkForm.projectId) return
    const payload = {
      projectId: linkForm.projectId,
      fundingAmount: linkForm.fundingAmount || null,
      currency: linkForm.currency,
      notes: linkForm.notes || null,
    }
    emit('link', payload as LinkDonorProjectPayload)
  }
  showLinkForm.value = false
}

// Create-project modal (stub) ------------------------------------------------
const showCreateProject = ref(false)
const creating = ref(false)
const newProject = reactive<{
  name: string
  code: string
  status: ProjectStatus
  startDate: string
  endDate: string
}>({
  name: '',
  code: '',
  status: 'planning',
  startDate: '',
  endDate: '',
})

const projectStatusOptions = PROJECT_STATUSES.map((s) => ({
  label: PROJECT_STATUS_LABEL[s],
  value: s,
}))

function openCreateProject() {
  Object.assign(newProject, {
    name: '',
    code: '',
    status: 'planning',
    startDate: '',
    endDate: '',
  })
  showCreateProject.value = true
}

async function createProject() {
  if (!newProject.name.trim()) return
  creating.value = true
  try {
    const payload: CreateProjectPayload = {
      name: newProject.name,
      code: newProject.code || null,
      description: null,
      status: newProject.status,
      startDate: newProject.startDate || null,
      endDate: newProject.endDate || null,
      totalBudget: null,
      currency: 'USD',
    }
    await $fetch('/api/projects', { method: 'POST', body: payload })
    toast.add({ title: 'Project created', color: 'success' })
    showCreateProject.value = false
    await refreshProjects()
    emit('project-created')
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.'
    toast.add({ title: 'Could not create project', description: msg, color: 'error' })
  } finally {
    creating.value = false
  }
}

function formatMoney(amount: string | null, currency: string): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return `${amount} ${currency}`
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}

const totalsByCurrency = computed(() => {
  const acc: Record<string, number> = {}
  for (const p of props.fundedProjects) {
    if (!p.fundingAmount) continue
    const n = Number(p.fundingAmount)
    if (Number.isNaN(n)) continue
    acc[p.currency] = (acc[p.currency] ?? 0) + n
  }
  return acc
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-default">Funded projects</h3>
          <p v-if="fundedProjects.length" class="mt-0.5 text-xs text-muted">
            {{ fundedProjects.length }} project{{ fundedProjects.length === 1 ? '' : 's' }}
            <template v-if="Object.keys(totalsByCurrency).length">
              · Funding
              <span
                v-for="(amt, ccy, i) in totalsByCurrency"
                :key="ccy"
                class="font-medium text-default"
              >
                <span v-if="i > 0">, </span>{{ formatMoney(String(amt), ccy) }}
              </span>
            </template>
          </p>
        </div>
        <div v-if="canEdit" class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-folder-plus"
            label="New project"
            @click="openCreateProject"
          />
          <UButton
            size="xs"
            variant="outline"
            icon="i-lucide-link"
            label="Link project"
            @click="openLink"
          />
        </div>
      </div>
    </template>

    <div
      v-if="!fundedProjects.length"
      class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      This donor isn't linked to any projects yet.
    </div>

    <ul v-else class="divide-y divide-default">
      <li v-for="p in fundedProjects" :key="p.projectId" class="space-y-1 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <p class="flex-1 text-sm font-medium text-default">
            {{ p.name }}
            <span v-if="p.code" class="text-xs font-normal text-muted">· {{ p.code }}</span>
          </p>
          <UBadge
            variant="subtle"
            :color="
              p.status === 'active'
                ? 'success'
                : p.status === 'completed'
                  ? 'neutral'
                  : p.status === 'cancelled'
                    ? 'error'
                    : 'warning'
            "
            size="xs"
            :label="PROJECT_STATUS_LABEL[p.status]"
          />
          <div v-if="canEdit" class="flex items-center gap-1">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit funding"
              @click="openEdit(p)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Unlink"
              @click="emit('unlink', p.projectId)"
            />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
          <div>
            <span class="font-medium text-default">Funding:</span>
            {{ formatMoney(p.fundingAmount, p.currency) }}
          </div>
          <div v-if="p.startDate || p.endDate">
            <span class="font-medium text-default">Term:</span>
            {{ p.startDate || '—' }} → {{ p.endDate || '—' }}
          </div>
        </div>
        <p v-if="p.notes" class="whitespace-pre-wrap text-xs text-muted">{{ p.notes }}</p>
      </li>
    </ul>

    <UModal v-model:open="showLinkForm" :title="editingProjectId ? 'Edit funding' : 'Link project'">
      <template #body>
        <div class="space-y-3">
          <UFormField v-if="!editingProjectId" label="Project" required>
            <USelectMenu
              v-model="linkForm.projectId"
              :items="linkProjectOptions"
              value-key="value"
              placeholder="Pick a project…"
              class="w-full"
            />
            <p v-if="!linkProjectOptions.length" class="mt-1 text-xs text-muted">
              All available projects are already linked. Use <b>New project</b> first.
            </p>
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Funding amount">
              <UInput
                v-model="linkForm.fundingAmount"
                type="number"
                placeholder="0"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Currency">
              <UInput v-model="linkForm.currency" maxlength="3" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Notes">
            <UTextarea v-model="linkForm.notes" :rows="2" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showLinkForm = false" />
          <UButton
            :label="editingProjectId ? 'Save' : 'Link'"
            :disabled="!editingProjectId && !linkForm.projectId"
            @click="submitLink"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showCreateProject" title="New project">
      <template #body>
        <div class="space-y-3">
          <UAlert
            color="primary"
            variant="subtle"
            icon="i-lucide-info"
            title="Stub project record"
            description="The full Project Management module ships later. For now this captures the basics so donor funding can be tracked."
          />
          <UFormField label="Name" required>
            <UInput v-model="newProject.name" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Code">
              <UInput v-model="newProject.code" placeholder="e.g. TZ-26-04" class="w-full" />
            </UFormField>
            <UFormField label="Status">
              <USelectMenu
                v-model="newProject.status"
                :items="projectStatusOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Start date">
              <UInput v-model="newProject.startDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="End date">
              <UInput v-model="newProject.endDate" type="date" class="w-full" />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showCreateProject = false" />
          <UButton
            label="Create"
            :loading="creating"
            :disabled="!newProject.name.trim()"
            @click="createProject"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
