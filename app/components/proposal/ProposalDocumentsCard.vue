<script setup lang="ts">
const props = withDefaults(defineProps<{ proposalId: string; canWrite?: boolean }>(), {
  canWrite: false,
})

interface Attachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  brief: string | null
  createdAt: string
  uploadedByFirstName: string | null
  uploadedByLastName: string | null
  url: string | null
}

const toast = useToast()
const { data, refresh } = await useFetch<{ attachments: Attachment[] }>(
  () => `/api/proposals/${props.proposalId}/attachments`,
  { key: () => `proposal-attachments-${props.proposalId}`, default: () => ({ attachments: [] }) }
)
const attachments = computed(() => data.value?.attachments ?? [])

const fileInput = ref<HTMLInputElement | null>(null)
const brief = ref('')
const uploading = ref(false)

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const body = new FormData()
  body.append('file', file)
  if (brief.value.trim()) body.append('brief', brief.value.trim())
  uploading.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}/attachments`, { method: 'POST', body })
    brief.value = ''
    if (fileInput.value) fileInput.value.value = ''
    await refresh()
    toast.add({ title: 'Document uploaded', color: 'success' })
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Upload failed'
    toast.add({ title: 'Upload failed', description: msg, color: 'error' })
  } finally {
    uploading.value = false
  }
}

async function remove(id: string) {
  try {
    await $fetch(`/api/proposals/${props.proposalId}/attachments/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not delete', description: msg, color: 'error' })
  }
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Proposal documents</h3>
        <span class="text-xs text-muted">{{ attachments.length }} file(s)</span>
      </div>
    </template>

    <div class="space-y-3">
      <ul v-if="attachments.length" class="space-y-2">
        <li
          v-for="a in attachments"
          :key="a.id"
          class="flex items-start justify-between gap-3 rounded-lg border border-default bg-default/40 p-3"
        >
          <div class="min-w-0 flex-1">
            <a
              v-if="a.url"
              :href="a.url"
              target="_blank"
              rel="noopener"
              class="truncate text-sm font-medium text-primary hover:underline"
            >
              {{ a.fileName }}
            </a>
            <span v-else class="truncate text-sm font-medium text-default">{{ a.fileName }}</span>
            <p class="text-xs text-muted">
              {{ sizeLabel(a.fileSize) }} ·
              {{
                [a.uploadedByFirstName, a.uploadedByLastName].filter(Boolean).join(' ') || 'Unknown'
              }}
            </p>
            <p v-if="a.brief" class="mt-1 text-xs text-default">{{ a.brief }}</p>
          </div>
          <UButton
            v-if="canWrite"
            size="xs"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            aria-label="Delete"
            @click="remove(a.id)"
          />
        </li>
      </ul>
      <p v-else class="text-sm text-muted">No documents uploaded yet.</p>

      <div v-if="canWrite" class="space-y-2 border-t border-default pt-3">
        <UInput v-model="brief" placeholder="Short brief (optional)…" size="sm" class="w-full" />
        <input
          ref="fileInput"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-primary"
          :disabled="uploading"
          @change="onFile"
        />
        <p class="text-xs text-muted">PDF, Word, or Excel · up to 25 MB.</p>
      </div>
    </div>
  </UCard>
</template>
