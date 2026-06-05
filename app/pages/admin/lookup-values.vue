<script setup lang="ts">
import {
  LOOKUP_KINDS,
  LOOKUP_KIND_LABEL,
  type CreateLookupPayload,
  type LookupKind,
} from '@@/shared/schemas/lookup'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Lookup values — Camel OS' })

interface LookupValue {
  id: string
  kind: LookupKind
  key: string
  label: string
  sortOrder: number
  archivedAt: string | null
  usageCount: number
}

const toast = useToast()

const { data, refresh, status } = useFetch<{ items: LookupValue[] }>('/api/admin/lookup-values', {
  key: 'admin-lookup-values',
  default: () => ({ items: [] }),
})

const byKind = computed(() => {
  const groups: Record<LookupKind, LookupValue[]> = {
    opportunity_source: [],
    opportunity_type: [],
  }
  for (const v of data.value?.items ?? []) {
    if (groups[v.kind]) groups[v.kind].push(v)
  }
  return groups
})

const activeKind = ref<LookupKind>('opportunity_source')
const activeItems = computed(() => byKind.value[activeKind.value] ?? [])

const summaries = computed(() =>
  LOOKUP_KINDS.map((k) => {
    const items = byKind.value[k]
    return {
      key: k,
      label: LOOKUP_KIND_LABEL[k],
      total: items.length,
      active: items.filter((v) => !v.archivedAt).length,
      archived: items.filter((v) => v.archivedAt).length,
    }
  })
)

const showAdd = ref(false)
const addKind = ref<LookupKind>('opportunity_source')
const addForm = reactive({ key: '', label: '' })
const submitting = ref(false)

function openAdd(kind: LookupKind) {
  addKind.value = kind
  addForm.key = ''
  addForm.label = ''
  showAdd.value = true
}

async function createValue() {
  if (!addForm.key.trim() || !addForm.label.trim()) return
  submitting.value = true
  try {
    await $fetch('/api/admin/lookup-values', {
      method: 'POST',
      body: {
        kind: addKind.value,
        key: addForm.key.trim().toLowerCase().replace(/\s+/g, '_'),
        label: addForm.label.trim(),
      } satisfies CreateLookupPayload,
    })
    toast.add({ title: 'Value added', color: 'success' })
    showAdd.value = false
    await refresh()
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Add failed.'
    toast.add({ title: 'Could not add', description: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}

async function renameValue(v: LookupValue, newLabel: string) {
  if (newLabel === v.label) return
  try {
    await $fetch(`/api/admin/lookup-values/${v.id}`, {
      method: 'PATCH',
      body: { label: newLabel },
    })
    toast.add({ title: 'Renamed', color: 'success' })
    await refresh()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Rename failed.'
    toast.add({ title: 'Could not rename', description: msg, color: 'error' })
  }
}

async function toggleArchive(v: LookupValue) {
  try {
    await $fetch(`/api/admin/lookup-values/${v.id}`, {
      method: 'PATCH',
      body: { archived: !v.archivedAt },
    })
    toast.add({ title: v.archivedAt ? 'Restored' : 'Archived', color: 'success' })
    await refresh()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Action failed.'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  }
}

const pendingDelete = ref<LookupValue | null>(null)

async function confirmDelete() {
  if (!pendingDelete.value) return
  const v = pendingDelete.value
  pendingDelete.value = null
  try {
    await $fetch(`/api/admin/lookup-values/${v.id}`, { method: 'DELETE' })
    toast.add({ title: 'Deleted', color: 'success' })
    await refresh()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Delete failed.'
    toast.add({ title: 'Could not delete', description: msg, color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="max-w-3xl">
      <h1 class="text-2xl font-semibold tracking-tight text-default">Lookup values</h1>
      <p class="mt-1 text-sm text-muted">
        Edit the dropdown options used across opportunities. Rename a label by clicking it — the
        internal key stays the same so existing records keep their reference. Archive hides a value
        from new records without breaking history; Delete removes it permanently and is only
        available when nothing uses it.
      </p>
    </header>

    <div v-if="status === 'pending'" class="py-12 text-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else>
      <!-- Tab strip with counts and a context-aware Add button. -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default pb-3">
        <nav class="flex gap-1" aria-label="Lookup categories">
          <button
            v-for="s in summaries"
            :key="s.key"
            type="button"
            :class="[
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
              activeKind === s.key
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted hover:text-default hover:bg-elevated/60',
            ]"
            @click="activeKind = s.key"
          >
            {{ s.label }}
            <UBadge
              variant="subtle"
              :color="activeKind === s.key ? 'primary' : 'neutral'"
              size="xs"
              :label="String(s.active)"
            />
          </button>
        </nav>
        <UButton size="sm" icon="i-lucide-plus" label="Add value" @click="openAdd(activeKind)" />
      </div>

      <!-- Table -->
      <div class="overflow-hidden rounded-xl border border-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated/40 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-4 py-2.5 text-left font-medium">Label</th>
              <th class="px-4 py-2.5 text-left font-medium">Key</th>
              <th class="px-4 py-2.5 text-left font-medium">Usage</th>
              <th class="px-4 py-2.5 text-left font-medium">Status</th>
              <th class="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="v in activeItems"
              :key="v.id"
              :class="['group transition-colors', v.archivedAt ? 'bg-elevated/20' : '']"
            >
              <td class="px-3 py-1.5 align-middle">
                <!-- S7 — inline-editable label. Always shows a visible border
                     + pencil affordance so admins know the cell is editable
                     without hovering first. Enter or blur saves; Esc cancels. -->
                <div class="flex items-center gap-2">
                  <input
                    :value="v.label"
                    type="text"
                    aria-label="Edit label"
                    :class="[
                      'w-full rounded-md border border-default bg-default/40 px-2 py-1 text-sm text-default outline-none transition-colors',
                      'hover:border-primary/40 focus:border-primary focus:bg-default',
                    ]"
                    @blur="(e: FocusEvent) => renameValue(v, (e.target as HTMLInputElement).value)"
                    @keydown.enter="(e: KeyboardEvent) => (e.target as HTMLInputElement).blur()"
                    @keydown.escape="
                      (e: KeyboardEvent) => {
                        ;(e.target as HTMLInputElement).value = v.label
                        ;(e.target as HTMLInputElement).blur()
                      }
                    "
                  />
                  <UIcon name="i-lucide-pencil" class="size-3.5 shrink-0 text-muted" />
                </div>
              </td>
              <td class="px-4 py-1.5 align-middle">
                <code class="rounded bg-elevated/60 px-1.5 py-0.5 text-xs text-muted">{{
                  v.key
                }}</code>
              </td>
              <td class="px-4 py-1.5 align-middle text-muted">
                <span v-if="v.usageCount > 0">
                  {{ v.usageCount }} opportunit{{ v.usageCount === 1 ? 'y' : 'ies' }}
                </span>
                <span v-else class="text-dimmed">—</span>
              </td>
              <td class="px-4 py-1.5 align-middle">
                <UBadge
                  :color="v.archivedAt ? 'warning' : 'success'"
                  variant="subtle"
                  size="xs"
                  :label="v.archivedAt ? 'Archived' : 'Active'"
                />
              </td>
              <td class="px-3 py-1.5 align-middle text-right">
                <div class="flex justify-end gap-1">
                  <UTooltip :text="v.archivedAt ? 'Restore' : 'Archive — hide from new records'">
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :icon="v.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
                      :aria-label="v.archivedAt ? 'Restore' : 'Archive'"
                      @click="toggleArchive(v)"
                    />
                  </UTooltip>
                  <UTooltip
                    :text="
                      v.usageCount > 0
                        ? `${v.usageCount} opportunit${v.usageCount === 1 ? 'y uses' : 'ies use'} this — archive instead.`
                        : 'Permanently delete'
                    "
                  >
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="error"
                      icon="i-lucide-trash-2"
                      aria-label="Delete"
                      :disabled="v.usageCount > 0"
                      @click="pendingDelete = v"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
            <tr v-if="!activeItems.length">
              <td colspan="5" class="px-4 py-8 text-center text-sm text-muted">
                No values yet. Click <strong>Add value</strong> to create one.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <UModal
      :open="!!pendingDelete"
      title="Delete value?"
      @update:open="!$event && (pendingDelete = null)"
    >
      <template #body>
        <p class="text-sm text-muted">
          Permanently delete
          <span class="font-medium text-default">"{{ pendingDelete?.label }}"</span> from
          {{ pendingDelete ? LOOKUP_KIND_LABEL[pendingDelete.kind] : '' }}? This cannot be undone.
        </p>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="pendingDelete = null" />
          <UButton color="error" label="Delete" @click="confirmDelete" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showAdd" :title="`Add ${LOOKUP_KIND_LABEL[addKind].toLowerCase()}`">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Label (shown in pickers)" required>
            <UInput v-model="addForm.label" placeholder="e.g. NGO Direct" class="w-full" />
          </UFormField>
          <UFormField
            label="Internal key"
            hint="lowercase, no spaces — used in the database and audit log"
            required
          >
            <UInput v-model="addForm.key" placeholder="e.g. ngo_direct" class="w-full font-mono" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showAdd = false" />
          <UButton :loading="submitting" label="Add" @click="createValue" />
        </div>
      </template>
    </UModal>
  </div>
</template>
