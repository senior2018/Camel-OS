<script setup lang="ts">
import {
  PROPOSAL_BEHAVIORS,
  PROPOSAL_BEHAVIOR_LABEL,
  type ProposalBehavior,
  type ProposalRoleDef,
} from '@@/shared/schemas/proposal-settings'

/**
 * P3.4-S3 — override the org's role catalogue and/or outcome stages for THIS
 * proposal only (e.g. a bid that needs a "Site Visit" stage or a "Donor
 * Liaison" role). Off = inherit the organisation default. Lead/manager only.
 */
const props = defineProps<{
  proposalId: string
  effectiveRoles: ProposalRoleDef[]
  effectiveStages: string[]
  rolesOverridden: boolean
  stagesOverridden: boolean
  canManage: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()

const overrideRoles = ref(props.rolesOverridden)
const overrideStages = ref(props.stagesOverridden)
const roles = ref<ProposalRoleDef[]>(props.effectiveRoles.map((r) => ({ ...r })))
const stages = ref<string[]>([...props.effectiveStages])

const behaviorItems = PROPOSAL_BEHAVIORS.map((b) => ({
  label: PROPOSAL_BEHAVIOR_LABEL[b],
  value: b,
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
function onLabel(r: ProposalRoleDef) {
  if (r.key.startsWith('new_role')) {
    const s = slugify(r.label)
    if (s) r.key = s
  }
}
function addStage() {
  stages.value.push('')
}

const saving = ref(false)
async function save() {
  const cleanRoles = roles.value
    .map((r) => ({ ...r, label: r.label.trim(), key: r.key || slugify(r.label) }))
    .filter((r) => r.label && r.key)
  if (overrideRoles.value && !cleanRoles.some((r) => r.behavior === 'lead')) {
    toast.add({ title: 'Keep at least one Lead role', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}/settings-override`, {
      method: 'PUT',
      body: {
        roles: overrideRoles.value ? cleanRoles : null,
        outcomeStages: overrideStages.value
          ? stages.value.map((s) => s.trim()).filter(Boolean)
          : null,
      },
    })
    toast.add({ title: 'Proposal settings saved', color: 'success' })
    emit('changed')
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-semibold text-default">Proposal settings</h3>
    </template>

    <!-- Read-only for non-managers -->
    <div v-if="!canManage" class="text-sm text-muted">
      <p>
        {{
          rolesOverridden || stagesOverridden
            ? 'Customised for this proposal.'
            : 'Using the organisation defaults.'
        }}
      </p>
    </div>

    <div v-else class="space-y-5">
      <p class="text-xs text-muted">
        These inherit your organisation's defaults. Override them only for this proposal when it
        needs something different.
      </p>

      <!-- Roles override -->
      <section class="space-y-2">
        <USwitch v-model="overrideRoles" label="Override roles for this proposal" />
        <div v-if="overrideRoles" class="space-y-2">
          <ul class="space-y-2">
            <li
              v-for="(role, i) in roles"
              :key="role.key"
              class="flex flex-wrap items-center gap-2 rounded-lg border border-default p-2"
            >
              <UIcon name="i-lucide-circle" class="size-2" :class="behaviorAccent[role.behavior]" />
              <UInput
                v-model="role.label"
                placeholder="Role name"
                size="sm"
                class="min-w-40 flex-1"
                @update:model-value="onLabel(role)"
              />
              <USelect
                v-model="role.behavior"
                :items="behaviorItems"
                value-key="value"
                size="sm"
                class="w-52"
              />
              <USwitch v-model="role.singleInstance" size="sm" />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                aria-label="Remove"
                @click="roles.splice(i, 1)"
              />
            </li>
          </ul>
          <UButton
            size="xs"
            variant="soft"
            icon="i-lucide-plus"
            label="Add role"
            @click="addRole"
          />
        </div>
        <p v-else class="text-xs text-dimmed">Inheriting the organisation's roles.</p>
      </section>

      <!-- Outcome stages override -->
      <section class="space-y-2 border-t border-default pt-4">
        <USwitch v-model="overrideStages" label="Override outcome stages for this proposal" />
        <div v-if="overrideStages" class="space-y-2">
          <ul class="space-y-2">
            <li v-for="(_, i) in stages" :key="i" class="flex items-center gap-2">
              <UInput v-model="stages[i]" placeholder="Stage label" size="sm" class="flex-1" />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                aria-label="Remove"
                @click="stages.splice(i, 1)"
              />
            </li>
          </ul>
          <UButton
            size="xs"
            variant="soft"
            icon="i-lucide-plus"
            label="Add stage"
            @click="addStage"
          />
        </div>
        <p v-else class="text-xs text-dimmed">Inheriting the organisation's outcome stages.</p>
      </section>

      <div class="flex justify-end">
        <UButton size="sm" label="Save settings" :loading="saving" @click="save" />
      </div>
    </div>
  </UCard>
</template>
