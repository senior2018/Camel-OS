<script setup lang="ts">
import type { OpportunityAttachment } from '@/composables/useOpportunityAttachments'

interface Props {
  opportunityId: string
  canUpload?: boolean
  canDelete?: boolean
}

const props = defineProps<Props>()

const opportunityRef = computed(() => props.opportunityId)
const { data, status, uploading, upload, download, remove } =
  useOpportunityAttachments(opportunityRef)

const fileInput = ref<HTMLInputElement | null>(null)

function triggerPicker() {
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  await upload(file)
  // Reset so the same filename can be re-selected after a failed upload.
  target.value = ''
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function uploaderLabel(a: OpportunityAttachment): string {
  const name = [a.uploadedByFirstName, a.uploadedByLastName].filter(Boolean).join(' ')
  return name || a.uploadedByEmail || 'Unknown'
}

function iconFor(mime: string): string {
  if (mime.startsWith('image/')) return 'i-lucide-image'
  if (mime === 'application/pdf') return 'i-lucide-file-text'
  if (mime.includes('word') || mime.includes('document')) return 'i-lucide-file-text'
  if (mime.includes('sheet') || mime.includes('excel')) return 'i-lucide-table'
  if (mime.includes('zip') || mime.includes('archive')) return 'i-lucide-file-archive'
  return 'i-lucide-file'
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-default">Attachments</h3>
      <div v-if="canUpload">
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          @change="onFileChange"
        />
        <UButton
          size="sm"
          variant="outline"
          icon="i-lucide-upload"
          :loading="uploading"
          label="Upload file"
          @click="triggerPicker"
        />
      </div>
    </div>

    <div v-if="status === 'pending'" class="flex justify-center py-4">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
    </div>

    <div
      v-else-if="!data?.attachments?.length"
      class="rounded-lg border border-dashed border-default p-4 text-center text-sm text-muted"
    >
      No attachments yet.
    </div>

    <ul v-else class="divide-y divide-default rounded-lg border border-default">
      <li v-for="att in data.attachments" :key="att.id" class="flex items-center gap-3 px-3 py-2">
        <UIcon :name="iconFor(att.mimeType)" class="size-5 shrink-0 text-muted" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-default">{{ att.fileName }}</p>
          <p class="text-xs text-muted">
            {{ formatBytes(att.sizeBytes) }} · {{ uploaderLabel(att) }}
          </p>
        </div>
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-download"
          aria-label="Download"
          @click="download(att)"
        />
        <UButton
          v-if="canDelete"
          size="xs"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          aria-label="Delete"
          @click="remove(att)"
        />
      </li>
    </ul>
  </div>
</template>
