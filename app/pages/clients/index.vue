<script setup lang="ts">
import type { CreateClientPayload } from '@@/shared/schemas/client'
import { CLIENT_TYPE_LABEL } from '@@/shared/schemas/client'
import { CLIENT_HEALTH_LABEL, clientHealth } from '@/composables/useClients'
import type { ClientHealth, ClientListItem } from '@/composables/useClients'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Clients — Camel OS' })

const { can } = await usePermissions()

if (!can.value('crm', 'read')) {
  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have permission to view clients.',
    fatal: true,
  })
}

const canCreate = computed(() => can.value('crm', 'create'))
const canDelete = computed(() => can.value('crm', 'delete'))

const { data, status, createClient, deleteClient } = useClients()

const search = ref('')
const typeFilter = ref<'all' | 'client' | 'prospect' | 'donor' | 'partner'>('all')
const healthFilter = ref<'all' | ClientHealth>('all')

const filtered = computed<ClientListItem[]>(() => {
  const items = data.value?.items ?? []
  const q = search.value.trim().toLowerCase()
  return items.filter((c) => {
    if (typeFilter.value !== 'all' && c.type !== typeFilter.value) return false
    if (healthFilter.value !== 'all' && clientHealth(c.lastInteractionAt) !== healthFilter.value)
      return false
    if (!q) return true
    const haystack = [c.name, c.email, c.industry, c.country]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
})

// ─── Create / edit modal ──────────────────────────────────────────────────────
const showFormModal = ref(false)
const editing = ref<ClientListItem | null>(null)
const submitting = ref(false)
const duplicates = ref<Array<{ id: string; name: string; email: string | null }>>([])

function openCreate() {
  editing.value = null
  duplicates.value = []
  showFormModal.value = true
}

async function handleSubmit(payload: CreateClientPayload, id: string | null) {
  if (id) return // editing in detail page; this page only creates from the modal
  if (!canCreate.value) return
  submitting.value = true
  duplicates.value = []
  const res = await createClient(payload)
  submitting.value = false
  if (res.client) {
    showFormModal.value = false
    await navigateTo(`/clients/${res.client.id}`)
  } else if (res.duplicates) {
    duplicates.value = res.duplicates
  }
}

const confirmDelete = ref<ClientListItem | null>(null)
async function confirmAndDelete() {
  if (!confirmDelete.value) return
  const c = confirmDelete.value
  confirmDelete.value = null
  await deleteClient(c)
}

const totalCount = computed(() => data.value?.items?.length ?? 0)
const filteredCount = computed(() => filtered.value.length)

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

function ownerLabel(c: ClientListItem): string {
  if (!c.ownerUserId) return '—'
  const name = [c.ownerFirstName, c.ownerLastName].filter(Boolean).join(' ')
  return name || c.ownerEmail || '—'
}

const healthCounts = computed(() => {
  const items = data.value?.items ?? []
  return {
    healthy: items.filter((c) => clientHealth(c.lastInteractionAt) === 'healthy').length,
    warm: items.filter((c) => clientHealth(c.lastInteractionAt) === 'warm').length,
    at_risk: items.filter((c) => clientHealth(c.lastInteractionAt) === 'at_risk').length,
  }
})

function healthDotClass(level: ClientHealth): string {
  if (level === 'healthy') return 'bg-success'
  if (level === 'warm') return 'bg-warning'
  return 'bg-error'
}

function typeBadgeColor(t: ClientListItem['type']) {
  // Visually distinct without being noisy — green clients, neutral prospects,
  // primary-tinted donors, info for partners.
  switch (t) {
    case 'client':
      return 'success' as const
    case 'donor':
      return 'primary' as const
    case 'partner':
      return 'info' as const
    default:
      return 'neutral' as const
  }
}

function ownerInitials(c: ClientListItem): string {
  if (!c.ownerUserId) return ''
  const f = (c.ownerFirstName ?? '').charAt(0).toUpperCase()
  const l = (c.ownerLastName ?? '').charAt(0).toUpperCase()
  return f + l || (c.ownerEmail?.charAt(0).toUpperCase() ?? '?')
}
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Clients</h1>
        <p class="mt-1 text-sm text-muted">
          Clients, prospects, donors, and partners — contacts, interactions, grants, and linked
          opportunities.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search clients…"
          size="md"
          class="w-full sm:w-72"
        />
        <UFieldGroup>
          <UButton
            :color="typeFilter === 'all' ? 'primary' : 'neutral'"
            :variant="typeFilter === 'all' ? 'solid' : 'outline'"
            label="All"
            @click="typeFilter = 'all'"
          />
          <UButton
            :color="typeFilter === 'client' ? 'primary' : 'neutral'"
            :variant="typeFilter === 'client' ? 'solid' : 'outline'"
            label="Clients"
            @click="typeFilter = 'client'"
          />
          <UButton
            :color="typeFilter === 'prospect' ? 'primary' : 'neutral'"
            :variant="typeFilter === 'prospect' ? 'solid' : 'outline'"
            label="Prospects"
            @click="typeFilter = 'prospect'"
          />
          <UButton
            :color="typeFilter === 'donor' ? 'primary' : 'neutral'"
            :variant="typeFilter === 'donor' ? 'solid' : 'outline'"
            label="Donors"
            @click="typeFilter = 'donor'"
          />
          <UButton
            :color="typeFilter === 'partner' ? 'primary' : 'neutral'"
            :variant="typeFilter === 'partner' ? 'solid' : 'outline'"
            label="Partners"
            @click="typeFilter = 'partner'"
          />
        </UFieldGroup>

        <UFieldGroup>
          <UButton
            :color="healthFilter === 'all' ? 'primary' : 'neutral'"
            :variant="healthFilter === 'all' ? 'solid' : 'outline'"
            label="Any health"
            @click="healthFilter = 'all'"
          />
          <UButton
            :color="healthFilter === 'healthy' ? 'primary' : 'neutral'"
            :variant="healthFilter === 'healthy' ? 'solid' : 'outline'"
            @click="healthFilter = 'healthy'"
          >
            <span class="inline-block size-2 rounded-full bg-success" />
            <span class="ml-1.5">Healthy ({{ healthCounts.healthy }})</span>
          </UButton>
          <UButton
            :color="healthFilter === 'warm' ? 'primary' : 'neutral'"
            :variant="healthFilter === 'warm' ? 'solid' : 'outline'"
            @click="healthFilter = 'warm'"
          >
            <span class="inline-block size-2 rounded-full bg-warning" />
            <span class="ml-1.5">Warm ({{ healthCounts.warm }})</span>
          </UButton>
          <UButton
            :color="healthFilter === 'at_risk' ? 'primary' : 'neutral'"
            :variant="healthFilter === 'at_risk' ? 'solid' : 'outline'"
            @click="healthFilter = 'at_risk'"
          >
            <span class="inline-block size-2 rounded-full bg-error" />
            <span class="ml-1.5">At risk ({{ healthCounts.at_risk }})</span>
          </UButton>
        </UFieldGroup>
        <UButton
          v-if="canCreate"
          size="md"
          icon="i-lucide-plus"
          class="ml-auto"
          @click="openCreate"
        >
          <span class="hidden sm:inline">New client</span>
          <span class="sm:hidden">New</span>
        </UButton>
      </div>
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else>
      <div
        v-if="totalCount === 0"
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
      >
        <UIcon name="i-lucide-users" class="size-10 text-muted" />
        <h2 class="text-lg font-semibold text-default">No clients yet</h2>
        <p class="max-w-md text-sm text-muted">
          Add your first client or prospect to start tracking the relationship.
        </p>
        <UButton
          v-if="canCreate"
          size="lg"
          icon="i-lucide-plus"
          label="New client"
          @click="openCreate"
        />
      </div>

      <div
        v-else-if="filteredCount === 0"
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
      >
        <UIcon name="i-lucide-search-x" class="size-10 text-muted" />
        <h2 class="text-lg font-semibold text-default">No matches</h2>
        <p class="text-sm text-muted">Try a different search or clear the filters.</p>
      </div>

      <template v-else>
        <p class="text-xs text-muted">Showing {{ filteredCount }} of {{ totalCount }}</p>

        <div class="overflow-x-auto rounded-xl border border-default">
          <table class="min-w-full divide-y divide-default text-sm">
            <thead class="bg-elevated/40 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="px-3 py-3 text-left font-medium" />
                <th class="px-4 py-3 text-left font-medium">Name</th>
                <th class="px-4 py-3 text-left font-medium">Type</th>
                <th class="px-4 py-3 text-left font-medium">Industry</th>
                <th class="px-4 py-3 text-left font-medium">Country</th>
                <th class="px-4 py-3 text-left font-medium">Owner</th>
                <th class="px-4 py-3 text-right font-medium">Opps</th>
                <th class="px-4 py-3 text-left font-medium">Last touch</th>
                <th v-if="canDelete" class="px-4 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default bg-default">
              <tr
                v-for="c in filtered"
                :key="c.id"
                class="cursor-pointer transition-colors hover:bg-elevated/40"
                @click="navigateTo(`/clients/${c.id}`)"
              >
                <td class="px-3 py-3">
                  <UTooltip :text="CLIENT_HEALTH_LABEL[clientHealth(c.lastInteractionAt)]">
                    <span
                      :class="[
                        'inline-block size-2.5 rounded-full',
                        healthDotClass(clientHealth(c.lastInteractionAt)),
                      ]"
                    />
                  </UTooltip>
                </td>
                <td class="px-4 py-3 font-medium text-default">{{ c.name }}</td>
                <td class="px-4 py-3">
                  <UBadge
                    :color="typeBadgeColor(c.type)"
                    variant="subtle"
                    size="xs"
                    :label="CLIENT_TYPE_LABEL[c.type]"
                  />
                </td>
                <td class="px-4 py-3 text-muted">{{ c.industry || '—' }}</td>
                <td class="px-4 py-3 text-muted">{{ c.country || '—' }}</td>
                <td class="px-4 py-3">
                  <div v-if="c.ownerUserId" class="flex items-center gap-2">
                    <div
                      class="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
                    >
                      {{ ownerInitials(c) }}
                    </div>
                    <span class="text-default">{{ ownerLabel(c) }}</span>
                  </div>
                  <span v-else class="text-muted">—</span>
                </td>
                <td class="px-4 py-3 text-right text-muted">{{ c.opportunityCount }}</td>
                <td class="px-4 py-3 text-muted">{{ formatRelative(c.lastInteractionAt) }}</td>
                <td v-if="canDelete" class="px-4 py-3 text-right" @click.stop>
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-trash-2"
                    aria-label="Delete"
                    @click="confirmDelete = c"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <ClientFormModal
      v-model:open="showFormModal"
      :initial="editing"
      :submitting="submitting"
      :duplicates="duplicates"
      @submit="handleSubmit"
      @open-duplicate="
        (id) => {
          showFormModal = false
          navigateTo(`/clients/${id}`)
        }
      "
    />

    <UModal
      :open="!!confirmDelete"
      title="Delete client?"
      @update:open="!$event && (confirmDelete = null)"
    >
      <template #body>
        <p class="text-sm text-muted">
          This will permanently delete
          <span class="font-medium text-default">{{ confirmDelete?.name }}</span>
          and every contact, interaction, and reminder linked to it. This cannot be undone.
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
