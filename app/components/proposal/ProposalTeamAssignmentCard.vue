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

const { assignments, assignTeamMember } = useProposalReview(computed(() => props.proposalId))

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

const userOptions = computed(() =>
  (teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id,
  }))
)

function assignedFor(role: ProposalAssignmentRole) {
  return assignments.value.find((a) => a.roleType === role)
}

const roleOptions = computed(() =>
  PROPOSAL_ASSIGNMENT_ROLES.filter((r) => !assignedFor(r)).map((r) => ({
    label: PROPOSAL_ASSIGNMENT_ROLE_LABEL[r],
    value: r,
  }))
)

function personName(role: ProposalAssignmentRole): string {
  const a = assignedFor(role)
  if (!a) return ''
  return (
    [a.assignedUserFirstName, a.assignedUserLastName].filter(Boolean).join(' ') ||
    a.assignedUserEmail
  )
}

const selectedRole = ref<ProposalAssignmentRole | undefined>(undefined)
const selectedUserId = ref<string | undefined>(undefined)
const saving = ref(false)

async function assign() {
  if (!selectedRole.value || !selectedUserId.value) return
  saving.value = true
  const ok = await assignTeamMember({
    roleType: selectedRole.value,
    assignedUserId: selectedUserId.value,
  })
  saving.value = false
  if (ok) {
    clearSelection()
    emit('changed')
  }
}

function clearSelection() {
  selectedRole.value = undefined
  selectedUserId.value = undefined
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Team assignment</h3>
        <span class="text-xs text-muted">{{ assignments.length }} assigned</span>
      </div>
    </template>

    <div class="space-y-3">
      <div class="grid gap-2">
        <div
          v-for="role in PROPOSAL_ASSIGNMENT_ROLES"
          :key="role"
          class="flex items-center justify-between rounded-lg border border-default bg-default/40 p-3"
        >
          <div>
            <p class="text-sm font-medium text-default">
              {{ PROPOSAL_ASSIGNMENT_ROLE_LABEL[role] }}
            </p>
            <p class="text-xs text-muted">{{ PROPOSAL_ASSIGNMENT_ROLE_DESCRIPTION[role] }}</p>
          </div>
          <div class="text-right">
            <span
              v-if="assignedFor(role)"
              class="inline-flex items-center gap-1 text-sm font-medium text-success"
            >
              <UIcon name="i-lucide-check" class="size-4" />
              {{ personName(role) }}
            </span>
            <span v-else class="text-xs text-muted">Unassigned</span>
          </div>
        </div>
      </div>

      <div v-if="canAssign && roleOptions.length" class="space-y-2 border-t border-default pt-3">
        <UFormField label="Role">
          <USelect
            v-model="selectedRole"
            :items="roleOptions"
            value-key="value"
            placeholder="Select a role…"
            class="w-full"
          />
        </UFormField>
        <UFormField v-if="selectedRole" label="Assign to">
          <USelect
            v-model="selectedUserId"
            :items="userOptions"
            value-key="value"
            placeholder="Select team member…"
            class="w-full"
          />
        </UFormField>
        <div v-if="selectedRole && selectedUserId" class="flex gap-2">
          <UButton :loading="saving" size="sm" label="Assign" @click="assign" />
          <UButton variant="ghost" size="sm" label="Cancel" @click="clearSelection" />
        </div>
      </div>

      <p v-else-if="canAssign" class="border-t border-default pt-3 text-xs text-muted">
        All roles assigned.
      </p>
    </div>
  </UCard>
</template>
