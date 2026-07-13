<script setup lang="ts">
import CommunicationsTabs from '~/components/communication/CommunicationsTabs.vue'
import CommunicationsReviewPolicyCard from '~/components/communication/CommunicationsReviewPolicyCard.vue'
import {
  CONTENT_LOOKUP_KINDS,
  CONTENT_LOOKUP_KIND_LABEL,
  type ContentLookupKind,
  type CreateContentLookupPayload,
} from '@@/shared/schemas/communication-settings'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Communications settings — Camel OS' })

// Editable by the communications leader (communications:admin) or an org admin —
// the same gate the API enforces. Officers and reviewers are bounced.
const { can } = await usePermissions()
const canManage = computed(
  () => can.value('communications', 'admin') || can.value('admin', 'admin')
)
if (!canManage.value) {
  throw createError({
    statusCode: 403,
    statusMessage: 'Only a communications leader or an admin can manage these settings.',
    fatal: true,
  })
}

interface LookupValue {
  id: string
  kind: ContentLookupKind
  key: string
  label: string
  sortOrder: number
  archivedAt: string | null
  usageCount: number
}

const toast = useToast()
const { data, refresh, status } = useFetch<{ items: LookupValue[] }>(
  '/api/communications/settings/lookups',
  { key: 'comms-lookups', default: () => ({ items: [] }) }
)

const byKind = computed(() => {
  const groups = { content_type: [], content_category: [] } as Record<
    ContentLookupKind,
    LookupValue[]
  >
  for (const v of data.value?.items ?? []) if (groups[v.kind]) groups[v.kind].push(v)
  return groups
})

const activeKind = ref<ContentLookupKind>('content_type')
const activeItems = computed(() => byKind.value[activeKind.value] ?? [])
const summaries = computed(() =>
  CONTENT_LOOKUP_KINDS.map((k) => ({
    key: k,
    label: CONTENT_LOOKUP_KIND_LABEL[k],
    active: (byKind.value[k] ?? []).filter((v) => !v.archivedAt).length,
  }))
)

const showAdd = ref(false)
const addForm = reactive({ key: '', label: '' })
const submitting = ref(false)
function openAdd() {
  addForm.key = ''
  addForm.label = ''
  showAdd.value = true
}
// Auto-suggest the machine key from the label as the leader types it.
watch(
  () => addForm.label,
  (label) => {
    addForm.key = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  }
)

async function createValue() {
  if (!addForm.key.trim() || !addForm.label.trim()) return
  submitting.value = true
  try {
    await $fetch('/api/communications/settings/lookups', {
      method: 'POST',
      body: {
        kind: activeKind.value,
        key: addForm.key.trim(),
        label: addForm.label.trim(),
      } satisfies CreateContentLookupPayload,
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
  if (newLabel === v.label || !newLabel.trim()) return
  try {
    await $fetch(`/api/communications/settings/lookups/${v.id}`, {
      method: 'PATCH',
      body: { label: newLabel.trim() },
    })
    await refresh()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Rename failed.'
    toast.add({ title: 'Could not rename', description: msg, color: 'error' })
  }
}

async function toggleArchive(v: LookupValue) {
  try {
    await $fetch(`/api/communications/settings/lookups/${v.id}`, {
      method: 'PATCH',
      body: { archived: !v.archivedAt },
    })
    await refresh()
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed.'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  }
}

const pendingDelete = ref<LookupValue | null>(null)
async function confirmDelete() {
  const v = pendingDelete.value
  if (!v) return
  pendingDelete.value = null
  try {
    await $fetch(`/api/communications/settings/lookups/${v.id}`, { method: 'DELETE' })
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
    <CommunicationsTabs class="-mt-1" />

    <header class="max-w-3xl">
      <h1 class="text-2xl font-semibold tracking-tight text-default">Communications settings</h1>
      <p class="mt-1 text-sm text-muted">
        Manage the content-type and category vocabularies that appear in the writing pickers. Rename
        a label by clicking it — the internal key stays fixed so existing content keeps its
        reference. Archive hides a value from new pickers without touching history; Delete is only
        available when nothing uses it. Content statuses are a fixed review workflow and aren't
        editable here.
      </p>
    </header>

    <!-- Review policy — who/how many must approve before the Lead publishes. -->
    <section class="max-w-xl">
      <CommunicationsReviewPolicyCard :can-manage="canManage" />
    </section>

    <!-- C2 — social platforms + per-platform performance metrics. -->
    <section class="max-w-xl">
      <CommunicationsPlatformsCard :can-manage="canManage" />
    </section>

    <div class="pt-2">
      <h2 class="text-sm font-semibold text-default">Vocabularies</h2>
      <p class="text-xs text-muted">Content types and categories shown in the writing pickers.</p>
    </div>

    <div v-if="status === 'pending'" class="py-12 text-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default pb-3">
        <nav class="flex gap-1" aria-label="Vocabularies">
          <button
            v-for="s in summaries"
            :key="s.key"
            type="button"
            :class="[
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
              activeKind === s.key
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted hover:bg-elevated/60 hover:text-default',
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
        <UButton size="sm" icon="i-lucide-plus" label="Add value" @click="openAdd" />
      </div>

      <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
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
                <div class="flex items-center gap-2">
                  <input
                    :value="v.label"
                    type="text"
                    aria-label="Edit label"
                    class="w-full rounded-md border border-default bg-default/40 px-2 py-1 text-sm text-default outline-none transition-colors hover:border-primary/40 focus:border-primary focus:bg-default"
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
                <span v-if="v.usageCount > 0"
                  >{{ v.usageCount }} item{{ v.usageCount === 1 ? '' : 's' }}</span
                >
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
                  <UTooltip :text="v.archivedAt ? 'Restore' : 'Archive — hide from new content'">
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
                        ? `${v.usageCount} item(s) use this — archive instead.`
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
          <span class="font-medium text-default">"{{ pendingDelete?.label }}"</span>? This cannot be
          undone.
        </p>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="pendingDelete = null" />
          <UButton color="error" label="Delete" @click="confirmDelete" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showAdd"
      :title="`Add ${CONTENT_LOOKUP_KIND_LABEL[activeKind].toLowerCase()}`"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField label="Label (shown in pickers)" required>
            <UInput
              v-model="addForm.label"
              placeholder="e.g. Case Study"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField
            label="Internal key"
            hint="lowercase, no spaces — stored on content records"
            required
          >
            <UInput v-model="addForm.key" placeholder="e.g. case_study" class="w-full font-mono" />
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
