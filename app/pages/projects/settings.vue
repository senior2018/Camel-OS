<script setup lang="ts">
import {
  DEFAULT_PROJECT_SETTINGS,
  type ProjectSettings,
  type UpdateProjectSettingsPayload,
} from '@@/shared/schemas/project-settings'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Project settings — Camel OS' })

// Editable by an admin or a project leader (project:admin) — same gate as the API.
const { can } = await usePermissions()
const canManage = computed(() => can.value('project', 'admin') || can.value('admin', 'admin'))
if (!canManage.value) {
  throw createError({
    statusCode: 403,
    statusMessage: 'Only an admin or a project leader can manage project settings.',
    fatal: true,
  })
}

const toast = useToast()
const { data, refresh, status } = useFetch<{ settings: ProjectSettings }>(
  '/api/projects/settings',
  {
    key: 'project-settings-admin',
    default: () => ({ settings: { ...DEFAULT_PROJECT_SETTINGS } }),
  }
)

const form = reactive<ProjectSettings>({ ...DEFAULT_PROJECT_SETTINGS })
watchEffect(() => {
  const s = data.value?.settings
  if (s) {
    form.reportSections = [...s.reportSections]
    form.closeChecklist = [...s.closeChecklist]
    form.budgetCategories = [...s.budgetCategories]
    form.teamRoles = [...s.teamRoles]
    form.requireBudgetRevisionApproval = s.requireBudgetRevisionApproval
  }
})

// Each editable vocabulary rendered by the same list editor.
const lists = [
  {
    key: 'reportSections' as const,
    title: 'Report template sections',
    help: 'Every project report is scaffolded with these sections and must fill them before review.',
    placeholder: 'e.g. Risks & mitigation',
  },
  {
    key: 'closeChecklist' as const,
    title: 'Close-out checklist',
    help: 'A project can only be closed once every item here is ticked.',
    placeholder: 'e.g. Assets returned',
  },
  {
    key: 'budgetCategories' as const,
    title: 'Budget categories',
    help: 'Suggested categories for budget lines and vendor links.',
    placeholder: 'e.g. Training',
  },
  {
    key: 'teamRoles' as const,
    title: 'Team roles',
    help: 'Roles offered when adding a member to a project team.',
    placeholder: 'e.g. Field Officer',
  },
]

const drafts = reactive<Record<string, string>>({
  reportSections: '',
  closeChecklist: '',
  budgetCategories: '',
  teamRoles: '',
})
function addItem(key: keyof ProjectSettings) {
  const v = drafts[key]?.trim()
  if (!v) return
  const list = form[key] as string[]
  if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) list.push(v)
  drafts[key] = ''
}
function removeItem(key: keyof ProjectSettings, i: number) {
  ;(form[key] as string[]).splice(i, 1)
}

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch('/api/projects/settings', {
      method: 'PUT',
      body: {
        reportSections: form.reportSections,
        closeChecklist: form.closeChecklist,
        budgetCategories: form.budgetCategories,
        teamRoles: form.teamRoles,
        requireBudgetRevisionApproval: form.requireBudgetRevisionApproval,
      } satisfies UpdateProjectSettingsPayload,
    })
    toast.add({ title: 'Project settings saved', color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="max-w-2xl">
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Back to projects"
          class="-ml-2"
          @click="navigateTo('/projects')"
        />
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-default">Project settings</h1>
        <p class="mt-1 text-sm text-muted">
          Customize the vocabularies the module uses — nothing here is hard-coded. Statuses are a
          fixed workflow and aren't editable.
        </p>
      </div>
      <UButton label="Save settings" :loading="saving" @click="save" />
    </header>

    <div v-if="status === 'pending'" class="py-12 text-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <UCard v-for="l in lists" :key="l.key">
        <template #header>
          <div>
            <h3 class="text-sm font-semibold text-default">{{ l.title }}</h3>
            <p class="mt-0.5 text-xs text-muted">{{ l.help }}</p>
          </div>
        </template>
        <ul class="space-y-1.5">
          <li
            v-for="(item, i) in form[l.key] as string[]"
            :key="i"
            class="flex items-center justify-between gap-2 rounded-lg border border-default bg-default px-3 py-1.5 text-sm shadow-sm"
          >
            <span class="text-default">{{ item }}</span>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Remove"
              @click="removeItem(l.key, i)"
            />
          </li>
          <li v-if="!(form[l.key] as string[]).length" class="text-xs text-muted">Nothing yet.</li>
        </ul>
        <div class="mt-3 flex gap-2">
          <UInput
            v-model="drafts[l.key]"
            :placeholder="l.placeholder"
            size="sm"
            class="flex-1"
            @keydown.enter.prevent="addItem(l.key)"
          />
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-plus"
            label="Add"
            @click="addItem(l.key)"
          />
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-default">Budget revision policy</h3>
        </template>
        <USwitch
          v-model="form.requireBudgetRevisionApproval"
          label="Require a manager to approve budget revisions before they take effect"
        />
        <p class="mt-2 text-xs text-muted">
          When on, changing a project's revised budget flags it as pending until a project leader or
          admin signs off.
        </p>
      </UCard>
    </div>
  </div>
</template>
