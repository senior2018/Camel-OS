<script setup lang="ts">
import {
  PROPOSAL_ASSIGNMENT_ROLES,
  PROPOSAL_ASSIGNMENT_ROLE_DESCRIPTION,
  PROPOSAL_ASSIGNMENT_ROLE_LABEL,
  type ProposalAssignmentRole,
} from '@@/shared/schemas/proposal-assignment'

const props = withDefaults(
  defineProps<{
    proposalId: string
    canAssign?: boolean
  }>(),
  { canAssign: false }
)

const emit = defineEmits<{ changed: [] }>()

const { assignments, saveAssignments } = useProposalReview(computed(() => props.proposalId))

interface TeamMember {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}
const { data: teamData } = await useFetch<{ members: TeamMember[] }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})

// Unassigned + every team member, reused for each role's picker.
const userItems = computed(() => [
  { label: 'Unassigned', value: null as string | null },
  ...(teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id as string | null,
  })),
])

// Editable draft: one entry per role, prefilled from the saved assignments.
// Resets whenever the saved set changes (i.e. after a successful save).
type Draft = Record<ProposalAssignmentRole, string | null>
function buildDraft(): Draft {
  const d = {} as Draft
  for (const role of PROPOSAL_ASSIGNMENT_ROLES) {
    d[role] = assignments.value.find((a) => a.roleType === role)?.assignedUserId ?? null
  }
  return d
}
const draft = reactive<Draft>(buildDraft())
watch(assignments, () => Object.assign(draft, buildDraft()))

const dirty = computed(() =>
  PROPOSAL_ASSIGNMENT_ROLES.some((role) => {
    const saved = assignments.value.find((a) => a.roleType === role)?.assignedUserId ?? null
    return draft[role] !== saved
  })
)

const saving = ref(false)
async function save() {
  saving.value = true
  const payload = {
    assignments: PROPOSAL_ASSIGNMENT_ROLES.filter((role) => draft[role]).map((role) => ({
      roleType: role,
      assignedUserId: draft[role] as string,
    })),
  }
  const ok = await saveAssignments(payload)
  saving.value = false
  if (ok) emit('changed')
}

function reset() {
  Object.assign(draft, buildDraft())
}

const assignedCount = computed(() => assignments.value.length)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Team assignment</h3>
        <span class="text-xs text-muted">{{ assignedCount }} assigned</span>
      </div>
    </template>

    <div class="space-y-3">
      <div
        v-for="role in PROPOSAL_ASSIGNMENT_ROLES"
        :key="role"
        class="rounded-lg border border-default bg-default/40 p-3"
      >
        <div class="mb-2">
          <p class="text-sm font-medium text-default">{{ PROPOSAL_ASSIGNMENT_ROLE_LABEL[role] }}</p>
          <p class="text-xs text-muted">{{ PROPOSAL_ASSIGNMENT_ROLE_DESCRIPTION[role] }}</p>
        </div>
        <USelect
          v-if="canAssign"
          v-model="draft[role]"
          :items="userItems"
          value-key="value"
          placeholder="Unassigned"
          class="w-full"
        />
        <p v-else class="text-sm text-muted">
          {{ userItems.find((u) => u.value === draft[role])?.label ?? 'Unassigned' }}
        </p>
      </div>

      <div v-if="canAssign" class="flex items-center gap-2 border-t border-default pt-3">
        <UButton :loading="saving" :disabled="!dirty" label="Save team" @click="save" />
        <UButton
          v-if="dirty"
          variant="ghost"
          color="neutral"
          label="Reset"
          :disabled="saving"
          @click="reset"
        />
        <span v-if="dirty" class="text-xs text-warning">Unsaved changes</span>
      </div>
    </div>
  </UCard>
</template>
