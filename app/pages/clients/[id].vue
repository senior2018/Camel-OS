<script setup lang="ts">
import { CLIENT_TYPE_LABEL, CLIENT_TYPES, PARTNERSHIP_TYPE_LABEL } from '@@/shared/schemas/client'
import type {
  ClientMetadata,
  ClientType,
  CreateGrantPayload,
  UpdateClientPayload,
  UpdateGrantPayload,
} from '@@/shared/schemas/client'
import type { CreateAgreementPayload, UpdateAgreementPayload } from '@@/shared/schemas/partnership'
import type { LinkDonorProjectPayload, UpdateDonorProjectPayload } from '@@/shared/schemas/project'
import { CLIENT_HEALTH_LABEL, clientHealth } from '@/composables/useClients'

definePageMeta({
  layout: 'dashboard',
})

const route = useRoute()
const clientId = computed(() => route.params.id as string)

const { can, isAdmin } = await usePermissions()
if (!can.value('crm', 'read')) {
  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have permission to view clients.',
    fatal: true,
  })
}

const canUpdate = computed(() => can.value('crm', 'update'))
const canDelete = computed(() => can.value('crm', 'delete'))

const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? '')

const {
  data,
  status,
  refresh,
  updateClient,
  addContact,
  updateContact,
  removeContact,
  logInteraction,
  removeInteraction,
  linkOpportunity,
  unlinkOpportunity,
  createReminder,
  updateReminder,
  removeReminder,
  createGrant,
  updateGrant,
  removeGrant,
  linkProject,
  updateProjectLink,
  unlinkProject,
  createAgreement,
  updateAgreement,
  removeAgreement,
} = useClient(clientId)

// Roster used by the reminder assignee picker.
interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
}
const { data: teamData } = await useFetch<{ members: TeamMember[] }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})

// Opportunities not already linked to this client — fed into the link picker.
interface OpportunitySummary {
  id: string
  title: string
}
const { data: oppData } = await useFetch<{ items: OpportunitySummary[] }>('/api/opportunities', {
  key: 'opportunities-list',
})
const availableOpportunities = computed(() => {
  const linkedIds = new Set(data.value?.linkedOpportunities.map((o) => o.opportunityId) ?? [])
  return (oppData.value?.items ?? []).filter((o) => !linkedIds.has(o.id))
})

useHead({ title: computed(() => `${data.value?.client.name ?? 'Client'} — Camel OS`) })

// Edit-mode for the profile card.
const editing = ref(false)
const editState = reactive<{
  firstName: string
  lastName: string
  organization: string
  type: ClientType
  industry: string
  country: string
  website: string
  phone: string
  email: string
  notes: string
  metadata: ClientMetadata
  reminderRecipientUserIds: string[]
}>({
  firstName: '',
  lastName: '',
  organization: '',
  type: 'prospect',
  industry: '',
  country: '',
  website: '',
  phone: '',
  email: '',
  notes: '',
  metadata: {},
  reminderRecipientUserIds: [],
})

const typeOptions = CLIENT_TYPES.map((t) => ({ label: CLIENT_TYPE_LABEL[t], value: t }))

// Extra people notified for this client's grant/renewal deadline reminders
// (the owner is always notified). Only relevant for donors & partners.
const recipientOptions = computed(() =>
  (teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id,
  }))
)

function startEdit() {
  if (!data.value) return
  const c = data.value.client
  editState.firstName = c.firstName ?? ''
  editState.lastName = c.lastName ?? ''
  // Pre-S7 rows have everything stuffed into `name`; surface it under
  // Organization so the admin can split it manually.
  editState.organization = c.organization ?? (!c.firstName && !c.lastName ? c.name : '')
  editState.type = c.type
  editState.industry = c.industry ?? ''
  editState.country = c.country ?? ''
  editState.website = c.website ?? ''
  editState.phone = c.phone ?? ''
  editState.email = c.email ?? ''
  editState.notes = c.notes ?? ''
  editState.metadata = (c.metadata ?? {}) as ClientMetadata
  editState.reminderRecipientUserIds = [...(c.reminderRecipientUserIds ?? [])]
  editing.value = true
}

async function saveEdit() {
  const payload: UpdateClientPayload = {
    firstName: editState.firstName || null,
    lastName: editState.lastName || null,
    organization: editState.organization || null,
    type: editState.type,
    industry: editState.industry || null,
    country: editState.country || null,
    website: editState.website || null,
    phone: editState.phone || null,
    email: editState.email || null,
    notes: editState.notes || null,
    metadata:
      editState.type === 'donor' || editState.type === 'partner'
        ? (editState.metadata ?? {})
        : null,
    reminderRecipientUserIds: editState.reminderRecipientUserIds,
  }
  const ok = await updateClient(payload)
  if (ok) editing.value = false
}

async function handleDelete() {
  if (!data.value) return
  await $fetch(`/api/clients/${clientId.value}`, { method: 'DELETE' })
  await navigateTo('/clients')
}

const showDeleteConfirm = ref(false)

function ownerLabel(): string {
  if (!data.value?.client.ownerUserId) return 'Unassigned'
  const c = data.value.client
  return [c.ownerFirstName, c.ownerLastName].filter(Boolean).join(' ') || c.ownerEmail || 'Unknown'
}

// CR-04 — interactions are ordered occurredAt DESC, so the first row is the
// freshest touch. Empty list → "at risk" (never contacted).
const healthLevel = computed(() => {
  const latest = data.value?.interactions[0]
  return clientHealth(latest?.occurredAt ?? null)
})

function healthColor(level: ReturnType<typeof clientHealth>): 'success' | 'warning' | 'error' {
  if (level === 'healthy') return 'success'
  if (level === 'warm') return 'warning'
  return 'error'
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <div v-else-if="!data" class="rounded-xl border border-dashed border-default p-12 text-center">
      <p class="text-sm text-muted">Client not found.</p>
      <UButton
        variant="ghost"
        label="Back to clients"
        class="mt-3"
        @click="navigateTo('/clients')"
      />
    </div>

    <template v-else>
      <header class="space-y-3">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="All clients"
          size="xs"
          @click="navigateTo('/clients')"
        />
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="text-2xl font-semibold tracking-tight text-default">
                {{ data.client.name }}
              </h1>
              <UBadge
                :color="data.client.type === 'client' ? 'success' : 'neutral'"
                variant="subtle"
                size="sm"
                :label="CLIENT_TYPE_LABEL[data.client.type]"
              />
              <UBadge
                :color="healthColor(healthLevel)"
                variant="subtle"
                size="sm"
                :label="CLIENT_HEALTH_LABEL[healthLevel]"
              />
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ data.client.industry || 'No industry' }}
              <span v-if="data.client.country"> · {{ data.client.country }}</span>
              · Assigned to: {{ ownerLabel() }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              v-if="canUpdate && !editing"
              variant="outline"
              icon="i-lucide-pencil"
              label="Edit"
              size="sm"
              @click="startEdit"
            />
            <UButton
              v-if="canDelete"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              label="Delete"
              size="sm"
              @click="showDeleteConfirm = true"
            />
          </div>
        </div>
      </header>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Profile + contacts column -->
        <div class="space-y-6 lg:col-span-1">
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-default">Profile</h3>
            </template>

            <div v-if="!editing" class="space-y-3 text-sm">
              <div v-if="data.client.firstName || data.client.lastName">
                <p class="text-xs uppercase tracking-wide text-muted">Contact name</p>
                <p class="text-default">
                  {{ [data.client.firstName, data.client.lastName].filter(Boolean).join(' ') }}
                </p>
              </div>
              <div v-if="data.client.organization">
                <p class="text-xs uppercase tracking-wide text-muted">Organization</p>
                <p class="text-default">{{ data.client.organization }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">Email</p>
                <p class="text-default">{{ data.client.email || '—' }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">Phone</p>
                <p class="text-default">{{ data.client.phone || '—' }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">Website</p>
                <p>
                  <a
                    v-if="data.client.website"
                    :href="data.client.website"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:underline"
                  >
                    {{ data.client.website }}
                  </a>
                  <span v-else class="text-default">—</span>
                </p>
              </div>
              <div v-if="data.client.notes">
                <p class="text-xs uppercase tracking-wide text-muted">Notes</p>
                <p class="whitespace-pre-wrap text-default">{{ data.client.notes }}</p>
              </div>

              <template v-if="data.client.type === 'donor' && data.client.metadata">
                <div v-if="data.client.metadata.focusAreas?.length">
                  <p class="text-xs uppercase tracking-wide text-muted">Focus areas</p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <UBadge
                      v-for="f in data.client.metadata.focusAreas"
                      :key="f"
                      variant="subtle"
                      color="primary"
                      size="xs"
                      :label="f"
                    />
                  </div>
                </div>
                <div v-if="data.client.metadata.reportingLanguage">
                  <p class="text-xs uppercase tracking-wide text-muted">Reporting language</p>
                  <p class="text-default">{{ data.client.metadata.reportingLanguage }}</p>
                </div>
                <div v-if="data.client.metadata.fiscalYearStart">
                  <p class="text-xs uppercase tracking-wide text-muted">Fiscal year start</p>
                  <p class="text-default">{{ data.client.metadata.fiscalYearStart }}</p>
                </div>
              </template>

              <template v-if="data.client.type === 'partner' && data.client.metadata">
                <div v-if="data.client.metadata.partnershipType">
                  <p class="text-xs uppercase tracking-wide text-muted">Partnership type</p>
                  <p class="text-default">
                    {{ PARTNERSHIP_TYPE_LABEL[data.client.metadata.partnershipType] }}
                  </p>
                </div>
                <div v-if="data.client.metadata.scope">
                  <p class="text-xs uppercase tracking-wide text-muted">Scope</p>
                  <p class="whitespace-pre-wrap text-default">{{ data.client.metadata.scope }}</p>
                </div>
              </template>
            </div>

            <div v-else class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="First name">
                  <UInput v-model="editState.firstName" class="w-full" />
                </UFormField>
                <UFormField label="Last name">
                  <UInput v-model="editState.lastName" class="w-full" />
                </UFormField>
              </div>
              <UFormField label="Organization" hint="Company, foundation, or institution.">
                <UInput v-model="editState.organization" class="w-full" />
              </UFormField>
              <UFormField label="Type">
                <USelectMenu
                  v-model="editState.type"
                  :items="typeOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Industry">
                <UInput v-model="editState.industry" class="w-full" />
              </UFormField>
              <UFormField label="Country">
                <UInput v-model="editState.country" class="w-full" />
              </UFormField>
              <UFormField label="Website">
                <UInput v-model="editState.website" class="w-full" />
              </UFormField>
              <UFormField label="Phone">
                <UInput v-model="editState.phone" class="w-full" />
              </UFormField>
              <UFormField label="Email">
                <UInput v-model="editState.email" type="email" class="w-full" />
              </UFormField>
              <UFormField label="Notes">
                <UTextarea v-model="editState.notes" :rows="3" class="w-full" />
              </UFormField>
              <ClientMetadataFields v-model="editState.metadata" :type="editState.type" />
              <UFormField
                v-if="editState.type === 'donor' || editState.type === 'partner'"
                label="Reminder recipients"
                help="Extra people emailed for grant/renewal deadlines. The owner is always notified."
              >
                <USelectMenu
                  v-model="editState.reminderRecipientUserIds"
                  :items="recipientOptions"
                  value-key="value"
                  multiple
                  placeholder="Owner only — add more…"
                  class="w-full"
                />
              </UFormField>
              <div class="flex justify-end gap-2">
                <UButton variant="ghost" label="Cancel" size="sm" @click="editing = false" />
                <UButton label="Save" size="sm" @click="saveEdit" />
              </div>
            </div>
          </UCard>

          <ClientContactsCard
            :contacts="data.contacts"
            :client-id="clientId"
            :can-edit="canUpdate"
            @add="(p) => addContact(p)"
            @update="(id, p) => updateContact(id, p)"
            @remove="(id) => removeContact(id)"
            @imported="refresh"
          />
        </div>

        <!-- Activity column -->
        <div class="space-y-6 lg:col-span-2">
          <ClientInteractionsCard
            :interactions="data.interactions"
            :contacts="data.contacts"
            :can-edit="canUpdate"
            :client-type="data.client.type"
            @log="(p) => logInteraction(p)"
            @remove="(id) => removeInteraction(id)"
          />

          <ClientOpportunitiesCard
            :linked="data.linkedOpportunities"
            :available="availableOpportunities"
            :can-edit="canUpdate"
            @link="(oppId, primary) => linkOpportunity(oppId, primary)"
            @unlink="(oppId) => unlinkOpportunity(oppId)"
          />

          <ClientDonorGrantsCard
            v-if="data.client.type === 'donor'"
            :grants="data.grants"
            :can-edit="canUpdate"
            @create="(p: CreateGrantPayload) => createGrant(p)"
            @update="(id: string, p: UpdateGrantPayload) => updateGrant(id, p)"
            @remove="(id: string) => removeGrant(id)"
          />
          <ClientFundedProjectsCard
            v-if="data.client.type === 'donor'"
            :funded-projects="data.fundedProjects"
            :can-edit="canUpdate"
            @link="(p: LinkDonorProjectPayload) => linkProject(p)"
            @update="
              (projectId: string, p: UpdateDonorProjectPayload) => updateProjectLink(projectId, p)
            "
            @unlink="(projectId: string) => unlinkProject(projectId)"
            @project-created="refresh"
          />

          <ClientPartnershipAgreementsCard
            v-if="data.client.type === 'partner'"
            :agreements="data.agreements"
            :can-edit="canUpdate"
            @create="(p: CreateAgreementPayload) => createAgreement(p)"
            @update="(id: string, p: UpdateAgreementPayload) => updateAgreement(id, p)"
            @remove="(id: string) => removeAgreement(id)"
          />

          <ClientRemindersCard
            :reminders="data.reminders"
            :team="teamData?.members ?? []"
            :current-user-id="currentUserId"
            :can-edit="canUpdate"
            :is-admin="isAdmin"
            @create="(p) => createReminder(p)"
            @update="(id, p) => updateReminder(id, p)"
            @remove="(id) => removeReminder(id)"
          />
        </div>
      </div>

      <UModal v-model:open="showDeleteConfirm" title="Delete client?">
        <template #body>
          <p class="text-sm text-muted">
            This will permanently delete
            <span class="font-medium text-default">{{ data.client.name }}</span>
            and every contact, interaction, link, and reminder attached to it. This cannot be
            undone.
          </p>
        </template>
        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton variant="ghost" label="Cancel" @click="showDeleteConfirm = false" />
            <UButton color="error" label="Delete" @click="handleDelete" />
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
