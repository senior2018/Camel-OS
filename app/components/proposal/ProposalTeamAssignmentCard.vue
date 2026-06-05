<script setup lang="ts">
import { PROPOSAL_ASSIGNMENT_ROLE_LABEL, PROPOSAL_ASSIGNMENT_ROLE_DESCRIPTION } from '@@/shared/schemas/proposal-assignment'
import type { ProposalAssignmentRole } from '@@/shared/schemas/proposal-assignment'

interface Props {
  proposalId: string
  canAssign?: boolean
}

withDefaults(defineProps<Props>(), {
  canAssign: false,
})

const props = defineProps<Props>()
const { assignments, refreshAssignments, assignTeamMember } = useProposalReview(
  computed(() => props.proposalId)
)

const { data: teamData } = await useFetch<{ members: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }> }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})

const selectedRole = ref<ProposalAssignmentRole | null>(null)
const selectedUserId = ref<string>('')
const isAssigning = ref(false)

const roles: ProposalAssignmentRole[] = [
  'lead',
  'technical_reviewer',
  'finance_reviewer',
  'compliance_reviewer',
  'final_approver',
]

const userOptions = computed(() =>
  (teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id,
  }))
)

function assignedUserForRole(role: ProposalAssignmentRole) {
  return assignments.value.find((a) => a.roleType === role)
}

async function assignUser() {
  if (!selectedRole.value || !selectedUserId.value) return

  isAssigning.value = true
  const ok = await assignTeamMember({
    roleType: selectedRole.value,
    assignedUserId: selectedUserId.value,
  })
  if (ok) {
    selectedRole.value = null
    selectedUserId.value = ''
  }
  isAssigning.value = false
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-semibold text-default">Team Assignment</h3>
    </template>

    <div class="space-y-3">
      <!-- Role assignments grid -->
      <div class="grid gap-3">
        <div
          v-for="role in roles"
          :key="role"
          class="flex items-center justify-between rounded-lg border border-default bg-default/40 p-3"
        >
          <div>
            <p class="text-sm font-medium text-default">{{ PROPOSAL_ASSIGNMENT_ROLE_LABEL[role] }}</p>
            <p class="text-xs text-muted">{{ PROPOSAL_ASSIGNMENT_ROLE_DESCRIPTION[role] }}</p>
          </div>

          <div class="text-right">
            <template v-if="assignedUserForRole(role)">
              <div class="flex flex-col items-end gap-1">
                <p class="text-sm font-medium text-success">
                  {{ assignedUserForRole(role)?.assignedUserFirstName }} {{ assignedUserForRole(role)?.assignedUserLastName || assignedUserForRole(role)?.assignedUserEmail }}
                </p>
                <UIcon name="i-lucide-check" class="size-4 text-success" />
              </div>
            </template>
            <template v-else>
              <UIcon name="i-lucide-user-plus" class="size-4 text-muted" />
            </template>
          </div>
        </div>
      </div>

      <!-- Assignment form -->
      <div v-if="canAssign" class="border-t border-default pt-3">
        <div class="space-y-2">
          <UFormGroup label="Role to assign:">
            <USelect
              v-model="selectedRole"
              :options="roles.filter(r => !assignedUserForRole(r))"
              :option-attribute="'label'"
              placeholder="Select a role..."
            >
              <template #label="{ option }">
                {{ PROPOSAL_ASSIGNMENT_ROLE_LABEL[option] }}
              </template>
            </USelect>
          </UFormGroup>

          <UFormGroup v-if="selectedRole" label="Assign to:">
            <USelect
              v-model="selectedUserId"
              :options="userOptions"
              placeholder="Select team member..."
            />
          </UFormGroup>

          <div v-if="selectedRole && selectedUserId" class="flex gap-2 pt-1">
            <UButton
              :loading="isAssigning"
              size="sm"
              label="Assign"
              @click="assignUser"
            />
            <UButton
              variant="ghost"
              size="sm"
              label="Cancel"
              @click="
                selectedRole = null
                selectedUserId = ''
              "
            />
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div v-if="assignments.length > 0" class="border-t border-default pt-3 text-xs text-muted">
        {{ assignments.length }} role{{ assignments.length !== 1 ? 's' : '' }} assigned
      </div>
    </div>
  </UCard>
</template>
