<script setup lang="ts">
import {
  BD_NOTE_KINDS,
  BD_NOTE_KIND_LABEL,
  type BdNoteKind,
} from '@@/shared/schemas/proposal-bd-note'

const props = withDefaults(defineProps<{ proposalId: string; canLog?: boolean }>(), {
  canLog: false,
})

interface BdNote {
  id: string
  kind: BdNoteKind
  body: string
  createdAt: string
  authorFirstName: string | null
  authorLastName: string | null
  attachmentFileName: string | null
  attachmentUrl: string | null
}

const toast = useToast()
const { data, refresh } = await useFetch<{ notes: BdNote[] }>(
  () => `/api/proposals/${props.proposalId}/bd-notes`,
  { key: () => `proposal-bd-notes-${props.proposalId}`, default: () => ({ notes: [] }) }
)
const notes = computed(() => data.value?.notes ?? [])

const kindItems = BD_NOTE_KINDS.map((k) => ({ label: BD_NOTE_KIND_LABEL[k], value: k }))
const kind = ref<BdNoteKind>('client_comm')
const body = ref('')
const file = ref<File | null>(null)
const saving = ref(false)

function onFileChange(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function add() {
  if (!body.value.trim()) return
  saving.value = true
  try {
    const fd = new FormData()
    fd.append('kind', kind.value)
    fd.append('body', body.value.trim())
    if (file.value) fd.append('file', file.value)
    await $fetch(`/api/proposals/${props.proposalId}/bd-notes`, { method: 'POST', body: fd })
    body.value = ''
    file.value = null
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not log', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}

function authorName(n: BdNote): string {
  return [n.authorFirstName, n.authorLastName].filter(Boolean).join(' ') || 'User'
}
function kindColor(k: BdNoteKind): 'info' | 'warning' | 'neutral' {
  if (k === 'client_comm') return 'info'
  if (k === 'evaluator_feedback') return 'warning'
  return 'neutral'
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-semibold text-default">Post-submission log</h3>
    </template>

    <div class="space-y-3">
      <div v-if="canLog" class="space-y-2">
        <USelect v-model="kind" :items="kindItems" value-key="value" size="sm" class="w-full" />
        <UTextarea
          v-model="body"
          :rows="2"
          placeholder="Log client communication or evaluator feedback…"
          class="w-full"
        />
        <div class="flex items-center justify-between gap-2">
          <label class="flex items-center gap-1.5 text-xs text-muted">
            <UIcon name="i-lucide-paperclip" class="size-3.5" />
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              class="max-w-48 text-xs"
              @change="onFileChange"
            />
          </label>
          <UButton
            size="xs"
            label="Add entry"
            :loading="saving"
            :disabled="!body.trim()"
            @click="add"
          />
        </div>
      </div>

      <ul v-if="notes.length" class="space-y-2">
        <li
          v-for="n in notes"
          :key="n.id"
          class="rounded-lg border border-default bg-default/40 p-2"
        >
          <div class="flex items-center justify-between gap-2">
            <UBadge :color="kindColor(n.kind)" variant="subtle" size="xs">
              {{ BD_NOTE_KIND_LABEL[n.kind] }}
            </UBadge>
            <span class="text-xs text-dimmed">
              {{ authorName(n) }} ·
              {{
                new Date(n.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              }}
            </span>
          </div>
          <p class="mt-1 whitespace-pre-wrap text-sm text-default">{{ n.body }}</p>
          <a
            v-if="n.attachmentUrl"
            :href="n.attachmentUrl"
            target="_blank"
            rel="noopener"
            class="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <UIcon name="i-lucide-paperclip" class="size-3" />
            {{ n.attachmentFileName }}
          </a>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">No entries yet.</p>
    </div>
  </UCard>
</template>
