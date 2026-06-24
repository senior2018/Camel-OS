<script setup lang="ts">
import {
  PROPOSAL_BEHAVIOR_LABEL,
  behaviorForRoleType,
  type ProposalBehavior,
  type ProposalRoleDef,
} from '@@/shared/schemas/proposal-settings'

/**
 * P3.4 — Manage Access (the workspace's membership surface). Every member holds
 * one configured role; the role's behaviour drives the workflow. One role per
 * person ⇒ separation of duties is automatic. Replaces the old lead/reviewers/
 * writers form. The Lead or a manager edits; others see a read-only roster.
 */
const props = withDefaults(
  defineProps<{
    proposalId: string
    roles: ProposalRoleDef[]
    canManage: boolean
    minReviewers?: number
  }>(),
  { minReviewers: 3 }
)
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()

interface Assignment {
  roleType: string
  roleLabel: string | null
  assignedUserId: string
  assignedUserEmail: string | null
  assignedUserFirstName: string | null
  assignedUserLastName: string | null
}
const { data: assignData, refresh } = await useFetch<{ assignments: Assignment[] }>(
  () => `/api/proposals/${props.proposalId}/assignments`,
  { key: () => `proposal-assignments-${props.proposalId}`, default: () => ({ assignments: [] }) }
)

interface Member {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}
const { data: poolData } = await useFetch<{ members: Member[] }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})
const userItems = computed(() =>
  (poolData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id,
  }))
)
function nameOf(userId: string): string {
  return userItems.value.find((u) => u.value === userId)?.label ?? 'Unknown'
}

const roleItems = computed(() => props.roles.map((r) => ({ label: r.label, value: r.key })))
const roleByKey = computed(() => new Map(props.roles.map((r) => [r.key, r])))
function roleKeyForAssignment(a: Assignment): string {
  const byLabel = props.roles.find((r) => r.label === a.roleLabel)
  if (byLabel) return byLabel.key
  const behavior = behaviorForRoleType(a.roleType)
  return props.roles.find((r) => r.behavior === behavior)?.key ?? props.roles[0]?.key ?? ''
}
const behaviorAccent: Record<ProposalBehavior, string> = {
  lead: 'text-primary',
  writer: 'text-info',
  reviewer: 'text-warning',
  approver: 'text-success',
  commenter: 'text-muted',
  viewer: 'text-dimmed',
}

// Editable draft: one role per person.
interface DraftRow {
  userId: string
  roleKey: string
}
const draft = ref<DraftRow[]>([])
function sync() {
  draft.value = (assignData.value?.assignments ?? []).map((a) => ({
    userId: a.assignedUserId,
    roleKey: roleKeyForAssignment(a),
  }))
}
watch(assignData, sync, { immediate: true })

const availableToAdd = computed(() =>
  userItems.value.filter((u) => !draft.value.some((d) => d.userId === u.value))
)
const addUser = ref<string | undefined>(undefined)
const addRole = ref<string>('')
watch(
  () => props.roles,
  (r) => {
    if (!addRole.value && r.length) addRole.value = r[0]!.key
  },
  { immediate: true }
)

function add() {
  if (!addUser.value || !addRole.value) return
  draft.value.push({ userId: addUser.value, roleKey: addRole.value })
  addUser.value = undefined
}
function remove(i: number) {
  draft.value.splice(i, 1)
}

const reviewerCount = computed(
  () => draft.value.filter((d) => roleByKey.value.get(d.roleKey)?.behavior === 'reviewer').length
)

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}/access`, {
      method: 'PUT',
      body: { members: draft.value },
    })
    toast.add({ title: 'Access updated', color: 'success' })
    await refresh()
    emit('changed')
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}

// Read-only grouping for non-managers.
const grouped = computed(() => {
  const byRole = new Map<string, { label: string; behavior: ProposalBehavior; people: string[] }>()
  for (const a of assignData.value?.assignments ?? []) {
    const key = roleKeyForAssignment(a)
    const role = roleByKey.value.get(key)
    const label = a.roleLabel || role?.label || a.roleType
    const behavior = role?.behavior ?? behaviorForRoleType(a.roleType)
    const name =
      [a.assignedUserFirstName, a.assignedUserLastName].filter(Boolean).join(' ') ||
      a.assignedUserEmail ||
      'User'
    const entry = byRole.get(label) ?? { label, behavior, people: [] }
    entry.people.push(name)
    byRole.set(label, entry)
  }
  return [...byRole.values()]
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Access &amp; team</h3>
        <UBadge
          :color="reviewerCount >= minReviewers ? 'success' : 'warning'"
          variant="subtle"
          size="xs"
          :label="`${reviewerCount} reviewer${reviewerCount === 1 ? '' : 's'} · ≥${minReviewers} to submit`"
        />
      </div>
    </template>

    <!-- Manager / Lead: editable roster -->
    <div v-if="canManage" class="space-y-3">
      <ul class="space-y-2">
        <li
          v-for="(row, i) in draft"
          :key="row.userId"
          class="flex flex-wrap items-center gap-2 rounded-lg border border-default p-2"
        >
          <UIcon
            name="i-lucide-circle"
            class="size-2 shrink-0"
            :class="behaviorAccent[roleByKey.get(row.roleKey)?.behavior ?? 'viewer']"
          />
          <span class="min-w-32 flex-1 truncate text-sm text-default">{{
            nameOf(row.userId)
          }}</span>
          <USelect
            v-model="row.roleKey"
            :items="roleItems"
            value-key="value"
            size="sm"
            class="w-52"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="error"
            icon="i-lucide-x"
            aria-label="Remove"
            @click="remove(i)"
          />
        </li>
        <li v-if="!draft.length" class="text-sm text-muted">No members yet — add someone below.</li>
      </ul>

      <div class="flex flex-wrap items-end gap-2 border-t border-default pt-3">
        <USelectMenu
          v-model="addUser"
          :items="availableToAdd"
          value-key="value"
          placeholder="Add a person…"
          size="sm"
          class="min-w-44 flex-1"
        />
        <USelect v-model="addRole" :items="roleItems" value-key="value" size="sm" class="w-52" />
        <UButton size="sm" icon="i-lucide-plus" label="Add" :disabled="!addUser" @click="add" />
      </div>

      <div class="flex items-center justify-between">
        <p class="text-xs text-muted">One role per person · reviewers can't also write.</p>
        <UButton size="sm" label="Save access" :loading="saving" @click="save" />
      </div>
    </div>

    <!-- Everyone else: read-only roster -->
    <div v-else class="space-y-3">
      <div v-for="g in grouped" :key="g.label">
        <div class="flex items-center gap-1.5">
          <UIcon name="i-lucide-circle" class="size-2" :class="behaviorAccent[g.behavior]" />
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ g.label }}</p>
          <span class="text-[10px] text-dimmed">· {{ PROPOSAL_BEHAVIOR_LABEL[g.behavior] }}</span>
        </div>
        <p class="mt-0.5 text-sm text-default">{{ g.people.join(', ') }}</p>
      </div>
      <p v-if="!grouped.length" class="text-sm text-muted">No members yet.</p>
    </div>
  </UCard>
</template>
