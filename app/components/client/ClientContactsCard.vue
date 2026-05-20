<script setup lang="ts">
import type { CreateContactPayload, UpdateContactPayload } from '@@/shared/schemas/client'
import type { ClientContact } from '@/composables/useClient'

interface Props {
  contacts: ClientContact[]
  canEdit: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  add: [payload: CreateContactPayload]
  update: [contactId: string, payload: UpdateContactPayload]
  remove: [contactId: string]
}>()

const editing = ref<ClientContact | null>(null)
const showForm = ref(false)

const form = reactive<{
  firstName: string
  lastName: string
  title: string
  email: string
  phone: string
  isPrimary: boolean
}>({
  firstName: '',
  lastName: '',
  title: '',
  email: '',
  phone: '',
  isPrimary: false,
})

function openNew() {
  editing.value = null
  Object.assign(form, {
    firstName: '',
    lastName: '',
    title: '',
    email: '',
    phone: '',
    isPrimary: props.contacts.length === 0,
  })
  showForm.value = true
}

function openEdit(c: ClientContact) {
  editing.value = c
  Object.assign(form, {
    firstName: c.firstName,
    lastName: c.lastName ?? '',
    title: c.title ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    isPrimary: c.isPrimary,
  })
  showForm.value = true
}

function submit() {
  const payload = {
    firstName: form.firstName,
    lastName: form.lastName || null,
    title: form.title || null,
    email: form.email || null,
    phone: form.phone || null,
    isPrimary: form.isPrimary,
  }
  if (editing.value) emit('update', editing.value.id, payload)
  else emit('add', payload as CreateContactPayload)
  showForm.value = false
}

function fullName(c: ClientContact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed'
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Contacts</h3>
        <UButton
          v-if="canEdit"
          size="xs"
          variant="outline"
          icon="i-lucide-plus"
          label="Add contact"
          @click="openNew"
        />
      </div>
    </template>

    <div
      v-if="!contacts.length"
      class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      No contacts yet.
    </div>

    <ul v-else class="divide-y divide-default">
      <li v-for="c in contacts" :key="c.id" class="flex items-center gap-3 py-3">
        <div
          class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        >
          {{ c.firstName.charAt(0).toUpperCase() }}{{ c.lastName?.charAt(0).toUpperCase() ?? '' }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="truncate text-sm font-medium text-default">{{ fullName(c) }}</p>
            <UBadge v-if="c.isPrimary" variant="subtle" color="primary" size="xs" label="Primary" />
          </div>
          <p class="truncate text-xs text-muted">
            {{ c.title || 'No title' }}{{ c.email ? ` · ${c.email}` : ''
            }}{{ c.phone ? ` · ${c.phone}` : '' }}
          </p>
        </div>
        <div v-if="canEdit" class="flex items-center gap-1">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-pencil"
            aria-label="Edit"
            @click="openEdit(c)"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            aria-label="Remove"
            @click="emit('remove', c.id)"
          />
        </div>
      </li>
    </ul>

    <UModal v-model:open="showForm" :title="editing ? 'Edit contact' : 'New contact'">
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="First name" required>
            <UInput v-model="form.firstName" class="w-full" />
          </UFormField>
          <UFormField label="Last name">
            <UInput v-model="form.lastName" class="w-full" />
          </UFormField>
          <UFormField label="Title" class="sm:col-span-2">
            <UInput v-model="form.title" class="w-full" />
          </UFormField>
          <UFormField label="Email">
            <UInput v-model="form.email" type="email" class="w-full" />
          </UFormField>
          <UFormField label="Phone">
            <UInput v-model="form.phone" class="w-full" />
          </UFormField>
          <UCheckbox v-model="form.isPrimary" label="Primary contact" class="sm:col-span-2" />
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showForm = false" />
          <UButton :label="editing ? 'Save' : 'Add'" @click="submit" />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
