<script setup lang="ts">
import {
  DEFAULT_OUTCOME_STAGES,
  PROPOSAL_BEHAVIORS,
  PROPOSAL_BEHAVIOR_LABEL,
  type ProposalBehavior,
  type ProposalRoleDef,
} from '@@/shared/schemas/proposal-settings'
import {
  PROPOSAL_REVIEW_RULES,
  PROPOSAL_REVIEW_RULE_LABEL,
  type ProposalReviewRule,
} from '@@/shared/schemas/proposal'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Proposal settings — Camel OS' })

const toast = useToast()

interface Settings {
  roles: ProposalRoleDef[]
  outcomeStages: string[]
  reviewMinReviewers: number
  reviewRule: ProposalReviewRule
  reviewThreshold: number | null
  requireFinalApprover: boolean
}

const { data, status, refresh } = await useFetch<{ settings: Settings }>(
  '/api/admin/proposal-settings',
  { key: 'admin-proposal-settings' }
)

const roles = ref<ProposalRoleDef[]>([])
const stages = ref<string[]>([])
const minReviewers = ref(3)
const rule = ref<ProposalReviewRule>('all')
const threshold = ref<number | null>(2)
const requireFinalApprover = ref(true)

watch(
  data,
  (d) => {
    if (!d?.settings) return
    roles.value = d.settings.roles.map((r) => ({ ...r }))
    stages.value = [...d.settings.outcomeStages]
    minReviewers.value = d.settings.reviewMinReviewers
    rule.value = d.settings.reviewRule
    threshold.value = d.settings.reviewThreshold ?? (d.settings.reviewRule === 'percent' ? 60 : 2)
    requireFinalApprover.value = d.settings.requireFinalApprover
  },
  { immediate: true }
)

const behaviorItems = PROPOSAL_BEHAVIORS.map((b) => ({
  label: PROPOSAL_BEHAVIOR_LABEL[b],
  value: b,
}))
const ruleItems = PROPOSAL_REVIEW_RULES.map((r) => ({
  label: PROPOSAL_REVIEW_RULE_LABEL[r],
  value: r,
}))
const behaviorAccent: Record<ProposalBehavior, string> = {
  lead: 'text-primary',
  writer: 'text-info',
  reviewer: 'text-warning',
  approver: 'text-success',
  commenter: 'text-muted',
  viewer: 'text-dimmed',
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}
function addRole() {
  const used = new Set(roles.value.map((r) => r.key))
  let key = 'new_role'
  let n = 1
  while (used.has(key)) key = `new_role_${n++}`
  roles.value.push({ key, label: '', behavior: 'reviewer' })
}
function removeRole(i: number) {
  roles.value.splice(i, 1)
}
// Keep the key in sync with the label for fresh roles (label-less or unmodified).
function onLabelInput(role: ProposalRoleDef) {
  if (role.key.startsWith('new_role')) {
    const slug = slugify(role.label)
    if (slug) role.key = slug
  }
}

function addStage() {
  stages.value.push('')
}
function removeStage(i: number) {
  stages.value.splice(i, 1)
}

const saving = ref(false)
async function save() {
  const cleanRoles = roles.value
    .map((r) => ({ ...r, label: r.label.trim(), key: r.key || slugify(r.label) }))
    .filter((r) => r.label && r.key)
  const cleanStages = stages.value.map((s) => s.trim()).filter(Boolean)
  if (!cleanRoles.some((r) => r.behavior === 'lead')) {
    toast.add({ title: 'Keep at least one Lead role', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/admin/proposal-settings', {
      method: 'PUT',
      body: {
        roles: cleanRoles,
        outcomeStages: cleanStages,
        reviewMinReviewers: minReviewers.value,
        reviewRule: rule.value,
        reviewThreshold: rule.value === 'all' ? null : threshold.value,
        requireFinalApprover: requireFinalApprover.value,
      },
    })
    toast.add({ title: 'Proposal settings saved', color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
function resetStagesToDefault() {
  stages.value = [...DEFAULT_OUTCOME_STAGES]
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Proposal settings</h1>
        <p class="mt-1 max-w-2xl text-sm text-muted">
          System-wide defaults every proposal inherits. A Lead or manager can override any of these
          per proposal.
        </p>
      </div>
      <UButton :loading="saving" icon="i-lucide-save" label="Save changes" @click="save" />
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else>
      <!-- Roles -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-default">Roles</h2>
              <p class="text-xs text-muted">
                Named roles your teams assign. Each maps to a fixed behaviour that drives the
                workflow — so "Technical Reviewer" and "Finance Reviewer" both act as reviewers.
              </p>
            </div>
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-plus"
              label="Add role"
              @click="addRole"
            />
          </div>
        </template>

        <ul class="space-y-2">
          <li
            v-for="(role, i) in roles"
            :key="role.key"
            class="flex flex-wrap items-center gap-2 rounded-lg border border-default p-2"
          >
            <UIcon name="i-lucide-circle" class="size-2" :class="behaviorAccent[role.behavior]" />
            <UInput
              v-model="role.label"
              placeholder="Role name (e.g. Legal Reviewer)"
              size="sm"
              class="min-w-48 flex-1"
              @update:model-value="onLabelInput(role)"
            />
            <USelect
              v-model="role.behavior"
              :items="behaviorItems"
              value-key="value"
              size="sm"
              class="w-56"
            />
            <UTooltip text="At most one holder per proposal (e.g. Lead, Approver)">
              <USwitch v-model="role.singleInstance" size="sm" />
            </UTooltip>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Remove role"
              @click="removeRole(i)"
            />
          </li>
        </ul>
      </UCard>

      <!-- Outcome stages -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-default">Evaluation outcome stages</h2>
              <p class="text-xs text-muted">
                The stages a submitted bid can move through (offered in the outcome popup).
              </p>
            </div>
            <div class="flex gap-2">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                label="Reset to default"
                @click="resetStagesToDefault"
              />
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add stage"
                @click="addStage"
              />
            </div>
          </div>
        </template>

        <ul class="space-y-2">
          <li v-for="(_, i) in stages" :key="i" class="flex items-center gap-2">
            <UInput v-model="stages[i]" placeholder="Stage label" size="sm" class="flex-1" />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Remove stage"
              @click="removeStage(i)"
            />
          </li>
          <li v-if="!stages.length" class="text-sm text-muted">No stages — add one.</li>
        </ul>
      </UCard>

      <!-- Default review policy -->
      <UCard>
        <template #header>
          <h2 class="text-sm font-semibold text-default">Default review policy</h2>
        </template>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Minimum reviewers">
            <UInputNumber v-model="minReviewers" :min="1" :max="20" class="w-full" />
          </UFormField>
          <UFormField label="Approval rule">
            <USelect v-model="rule" :items="ruleItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField
            v-if="rule !== 'all'"
            :label="rule === 'percent' ? 'Percentage (%)' : 'How many'"
          >
            <UInputNumber
              v-model="threshold"
              :min="1"
              :max="rule === 'percent' ? 100 : 20"
              class="w-full"
            />
          </UFormField>
          <UFormField class="sm:col-span-2">
            <USwitch v-model="requireFinalApprover" label="Require a final approver by default" />
          </UFormField>
        </div>
      </UCard>

      <div class="flex justify-end">
        <UButton :loading="saving" icon="i-lucide-save" label="Save changes" @click="save" />
      </div>
    </template>
  </div>
</template>
