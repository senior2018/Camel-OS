<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  CLIENT_TYPES,
  CLIENT_TYPE_LABEL,
  createClientSchema,
  type ClientMetadata,
  type ClientType,
  type CreateClientPayload,
} from '@@/shared/schemas/client'
import type { ClientListItem } from '@/composables/useClients'

interface Props {
  open: boolean
  initial: ClientListItem | null
  submitting?: boolean
  canDelete?: boolean
  readOnly?: boolean
  /** Duplicates returned from a failed create — populated by the parent. */
  duplicates?: Array<{ id: string; name: string; email: string | null }>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: CreateClientPayload, id: string | null]
  delete: [client: ClientListItem]
  'open-duplicate': [id: string]
}>()

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

const ownerOptions = computed(() => [
  { label: 'Unassigned', value: null as string | null },
  ...(teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id as string | null,
  })),
])

const typeOptions = CLIENT_TYPES.map((t) => ({
  label: CLIENT_TYPE_LABEL[t],
  value: t,
}))

const state = reactive<{
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
  ownerUserId: string | null
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
  ownerUserId: null,
})

watch(
  () => [props.open, props.initial] as const,
  ([open, initial]) => {
    if (!open) return
    if (initial) {
      state.firstName = initial.firstName ?? ''
      state.lastName = initial.lastName ?? ''
      // Fall back to the legacy `name` field for pre-S7 rows that never had
      // firstName/lastName/organization populated — the user can split it.
      state.organization =
        initial.organization ?? (!initial.firstName && !initial.lastName ? initial.name : '')
      state.type = initial.type
      state.industry = initial.industry ?? ''
      state.country = initial.country ?? ''
      state.website = initial.website ?? ''
      state.phone = initial.phone ?? ''
      state.email = initial.email ?? ''
      state.notes = ''
      state.metadata = {}
      state.ownerUserId = initial.ownerUserId
    } else {
      state.firstName = ''
      state.lastName = ''
      state.organization = ''
      state.type = 'prospect'
      state.industry = ''
      state.country = ''
      state.website = ''
      state.phone = ''
      state.email = ''
      state.notes = ''
      state.metadata = {}
      state.ownerUserId = null
    }
  },
  { immediate: true }
)

function onSubmit(_e: FormSubmitEvent<unknown>) {
  emit(
    'submit',
    {
      firstName: state.firstName || null,
      lastName: state.lastName || null,
      organization: state.organization || null,
      type: state.type,
      industry: state.industry || null,
      country: state.country || null,
      website: state.website || null,
      phone: state.phone || null,
      email: state.email || null,
      notes: state.notes || null,
      // Only send metadata when the type actually uses it — keeps the DB row tidy.
      metadata: state.type === 'donor' || state.type === 'partner' ? (state.metadata ?? {}) : null,
      ownerUserId: state.ownerUserId,
    },
    props.initial?.id ?? null
  )
}
</script>

<template>
  <UModal
    :open="open"
    :title="readOnly ? 'Client details' : initial ? 'Edit client' : 'New client'"
    description="Create or edit client information."
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UAlert
        v-if="readOnly"
        color="neutral"
        variant="subtle"
        icon="i-lucide-eye"
        title="View only"
        description="You don't have permission to edit clients. Contact your administrator to request access."
        class="mb-4"
      />

      <UAlert
        v-if="duplicates && duplicates.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Possible duplicate"
        class="mb-4"
      >
        <template #description>
          <p class="text-sm">A client with a matching name or email already exists:</p>
          <ul class="mt-2 space-y-1">
            <li v-for="d in duplicates" :key="d.id">
              <UButton
                size="xs"
                variant="link"
                :label="d.email ? `${d.name} — ${d.email}` : d.name"
                @click="emit('open-duplicate', d.id)"
              />
            </li>
          </ul>
        </template>
      </UAlert>

      <UForm
        id="client-form"
        :schema="createClientSchema"
        :state="state"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UFormField label="First name" name="firstName">
          <UInput
            v-model="state.firstName"
            placeholder="Aisha"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Last name" name="lastName">
          <UInput
            v-model="state.lastName"
            placeholder="Karim"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField
          label="Organization"
          name="organization"
          class="sm:col-span-2"
          hint="The company, foundation, or institution this client represents (or works for)."
        >
          <UInput
            v-model="state.organization"
            placeholder="Acme Consulting Ltd."
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Type" name="type" required>
          <USelectMenu
            v-model="state.type"
            :items="typeOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Industry" name="industry">
          <UInput
            v-model="state.industry"
            placeholder="Energy, Health, …"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Country" name="country">
          <UInput v-model="state.country" size="lg" class="w-full" :disabled="readOnly" />
        </UFormField>

        <UFormField label="Website" name="website">
          <UInput
            v-model="state.website"
            placeholder="https://…"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Phone" name="phone">
          <UInput v-model="state.phone" size="lg" class="w-full" :disabled="readOnly" />
        </UFormField>

        <UFormField label="Email" name="email">
          <UInput
            v-model="state.email"
            type="email"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Assigned to" name="ownerUserId" class="sm:col-span-2">
          <USelectMenu
            v-model="state.ownerUserId"
            :items="ownerOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <ClientMetadataFields v-model="state.metadata" :type="state.type" :disabled="readOnly" />

        <UFormField v-if="!initial" label="Notes" name="notes" class="sm:col-span-2">
          <UTextarea
            v-model="state.notes"
            :rows="3"
            placeholder="Internal notes about this client"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <UButton
          v-if="initial && canDelete && !readOnly"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          label="Delete"
          @click="emit('delete', initial)"
        />
        <div class="ml-auto flex gap-3">
          <UButton
            variant="ghost"
            :label="readOnly ? 'Close' : 'Cancel'"
            @click="emit('update:open', false)"
          />
          <UButton
            v-if="!readOnly"
            type="submit"
            form="client-form"
            :loading="submitting"
            :label="initial ? 'Save changes' : 'Create client'"
            trailing-icon="i-lucide-check"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
