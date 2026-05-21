<script setup lang="ts">
import type { CreateContactPayload, UpdateContactPayload } from '@@/shared/schemas/client'
import type { ClientContact } from '@/composables/useClient'

interface Props {
  contacts: ClientContact[]
  canEdit: boolean
  clientId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  add: [payload: CreateContactPayload]
  update: [contactId: string, payload: UpdateContactPayload]
  remove: [contactId: string]
  imported: []
}>()

interface ImportSummary {
  total: number
  inserted: number
  updated: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

const showImport = ref(false)
const importMode = ref<'skip' | 'overwrite'>('skip')
const importFile = ref<File | null>(null)
const importing = ref(false)
const importResult = ref<ImportSummary | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const toast = useToast()

function openImport() {
  importMode.value = 'skip'
  importFile.value = null
  importResult.value = null
  showImport.value = true
}

function onImportFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  importFile.value = target.files?.[0] ?? null
}

async function runImport() {
  if (!importFile.value) return
  importing.value = true
  try {
    const body = new FormData()
    body.append('file', importFile.value)
    body.append('mode', importMode.value)
    const res = await $fetch<{ success: boolean; summary: ImportSummary }>(
      `/api/clients/${props.clientId}/contacts/import`,
      { method: 'POST', body }
    )
    importResult.value = res.summary
    toast.add({
      title: 'Import complete',
      description: `${res.summary.inserted} added · ${res.summary.updated} updated · ${res.summary.skipped} skipped · ${res.summary.errors.length} errors`,
      color: res.summary.errors.length ? 'warning' : 'success',
    })
    emit('imported')
  } catch (err) {
    toast.add({
      title: 'Import failed',
      description:
        (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.',
      color: 'error',
    })
  } finally {
    importing.value = false
  }
}

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
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-default">Contacts</h3>
        <div class="flex items-center gap-2">
          <UButton
            v-if="canEdit"
            size="xs"
            variant="ghost"
            icon="i-lucide-upload"
            label="Import"
            @click="openImport"
          />
          <UButton
            v-if="canEdit"
            size="xs"
            variant="outline"
            icon="i-lucide-plus"
            label="Add contact"
            @click="openNew"
          />
        </div>
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

    <UModal v-model:open="showImport" title="Import contacts">
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="neutral"
            variant="subtle"
            icon="i-lucide-info"
            title="CSV format"
            description="One contact per row. Required columns: first_name, last_name, title, email, phone."
          >
            <template #actions>
              <UButton
                size="xs"
                variant="link"
                icon="i-lucide-download"
                label="Download template"
                to="/api/crm/contacts-template.csv"
                external
              />
            </template>
          </UAlert>

          <UFormField label="CSV file" required>
            <input
              ref="importFileInput"
              type="file"
              accept=".csv,text/csv"
              class="block w-full text-sm text-default file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-default file:bg-elevated/40 file:px-3 file:py-1.5 file:text-sm"
              @change="onImportFileChange"
            />
          </UFormField>

          <UFormField label="On duplicate email" hint="Match is per-client, not global.">
            <USelectMenu
              v-model="importMode"
              :items="[
                { label: 'Skip the row', value: 'skip' },
                { label: 'Overwrite the existing contact', value: 'overwrite' },
              ]"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <div v-if="importResult" class="space-y-2 rounded-lg border border-default p-3 text-sm">
            <p class="font-medium text-default">
              {{ importResult.inserted }} added · {{ importResult.updated }} updated ·
              {{ importResult.skipped }} skipped · {{ importResult.errors.length }} errors
            </p>
            <details v-if="importResult.errors.length">
              <summary class="cursor-pointer text-xs text-muted">Show row errors</summary>
              <ul class="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-error">
                <li v-for="e in importResult.errors" :key="e.row">
                  Row {{ e.row }}: {{ e.message }}
                </li>
              </ul>
            </details>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Close" @click="showImport = false" />
          <UButton :disabled="!importFile" :loading="importing" label="Import" @click="runImport" />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
