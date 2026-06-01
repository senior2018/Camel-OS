<script setup lang="ts">
import {
  CLIENT_INTERACTION_TYPE_LABEL,
  interactionTypesForClient,
  type ClientInteractionType,
  type ClientType,
  type CreateInteractionPayload,
} from '@@/shared/schemas/client'
import type { ClientContact, ClientInteraction } from '@/composables/useClient'

interface Props {
  interactions: ClientInteraction[]
  contacts: ClientContact[]
  canEdit: boolean
  clientType: ClientType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  log: [payload: CreateInteractionPayload]
  remove: [interactionId: string]
}>()

const showForm = ref(false)

const form = reactive<{
  type: ClientInteractionType
  occurredAt: string
  summary: string
  contactId: string | null
  followUpAt: string
  followUpAction: string
}>({
  type: 'meeting',
  occurredAt: new Date().toISOString().slice(0, 10),
  summary: '',
  contactId: null,
  followUpAt: '',
  followUpAction: '',
})

// CR-13 — donor and partner clients get their own communication categories on
// top of the defaults. Everyone else only sees the common types.
const typeOptions = computed(() =>
  interactionTypesForClient(props.clientType).map((t) => ({
    label: CLIENT_INTERACTION_TYPE_LABEL[t],
    value: t,
  }))
)

const contactOptions = computed(() => [
  { label: 'No specific contact', value: null as string | null },
  ...props.contacts.map((c) => ({
    label: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unnamed',
    value: c.id as string | null,
  })),
])

function openForm() {
  Object.assign(form, {
    type: 'meeting',
    occurredAt: new Date().toISOString().slice(0, 10),
    summary: '',
    contactId: null,
    followUpAt: '',
    followUpAction: '',
  })
  showForm.value = true
}

function submit() {
  if (!form.summary.trim()) return
  emit('log', {
    type: form.type,
    occurredAt: new Date(form.occurredAt).toISOString(),
    summary: form.summary,
    contactId: form.contactId,
    followUpAt: form.followUpAt || null,
    followUpAction: form.followUpAction || null,
  } as CreateInteractionPayload)
  showForm.value = false
}

const TYPE_ICON: Record<ClientInteractionType, string> = {
  meeting: 'i-lucide-users',
  call: 'i-lucide-phone',
  email: 'i-lucide-mail',
  note: 'i-lucide-sticky-note',
  other: 'i-lucide-message-square',
  donor_reporting: 'i-lucide-file-bar-chart',
  grant_negotiation: 'i-lucide-handshake',
  partnership_meeting: 'i-lucide-handshake',
}

function authorLabel(i: ClientInteraction): string {
  return (
    [i.createdByFirstName, i.createdByLastName].filter(Boolean).join(' ') ||
    i.createdByEmail ||
    'Unknown'
  )
}

function contactLabel(contactId: string | null): string | null {
  if (!contactId) return null
  const c = props.contacts.find((x) => x.id === contactId)
  if (!c) return null
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Interactions</h3>
        <UButton
          v-if="canEdit"
          size="xs"
          variant="outline"
          icon="i-lucide-plus"
          label="Log interaction"
          @click="openForm"
        />
      </div>
    </template>

    <div
      v-if="!interactions.length"
      class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      No interactions logged yet.
    </div>

    <ol v-else class="relative space-y-4 border-l border-default pl-6">
      <li v-for="i in interactions" :key="i.id" class="relative">
        <span
          class="absolute -left-[33px] top-1 flex size-6 items-center justify-center rounded-full border border-default bg-default"
        >
          <UIcon :name="TYPE_ICON[i.type]" class="size-3.5 text-muted" />
        </span>
        <div class="rounded-lg border border-default bg-default p-3">
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
            <UBadge
              variant="subtle"
              color="neutral"
              size="xs"
              :label="CLIENT_INTERACTION_TYPE_LABEL[i.type]"
            />
            <span>{{ formatDate(i.occurredAt) }}</span>
            <span class="text-dimmed">·</span>
            <span>{{ authorLabel(i) }}</span>
            <span v-if="contactLabel(i.contactId)" class="text-dimmed">·</span>
            <span v-if="contactLabel(i.contactId)">with {{ contactLabel(i.contactId) }}</span>
            <UButton
              v-if="canEdit"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Delete"
              class="ml-auto"
              @click="emit('remove', i.id)"
            />
          </div>
          <p class="mt-2 whitespace-pre-wrap text-sm text-default">{{ i.summary }}</p>
          <div
            v-if="i.followUpAt || i.followUpAction"
            class="mt-2 rounded-md bg-elevated/40 px-3 py-2 text-xs text-muted"
          >
            <UIcon name="i-lucide-arrow-right-circle" class="mr-1 inline size-3.5 text-primary" />
            <span class="font-medium text-default">Follow-up</span>
            <span v-if="i.followUpAt"> by {{ i.followUpAt }}</span>
            <span v-if="i.followUpAction">: {{ i.followUpAction }}</span>
          </div>
        </div>
      </li>
    </ol>

    <UModal v-model:open="showForm" title="Log interaction">
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="Type" required>
            <USelectMenu
              v-model="form.type"
              :items="typeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Date" required>
            <UInput v-model="form.occurredAt" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Contact" class="sm:col-span-2">
            <USelectMenu
              v-model="form.contactId"
              :items="contactOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Summary" required class="sm:col-span-2">
            <UTextarea v-model="form.summary" :rows="4" class="w-full" />
          </UFormField>
          <UFormField label="Follow-up by">
            <UInput v-model="form.followUpAt" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Follow-up action">
            <UInput v-model="form.followUpAction" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showForm = false" />
          <UButton label="Log" @click="submit" />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
