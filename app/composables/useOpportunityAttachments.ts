export interface OpportunityAttachment {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  uploadedByUserId: string | null
  uploadedByEmail: string | null
  uploadedByFirstName: string | null
  uploadedByLastName: string | null
}

interface AttachmentsResponse {
  attachments: OpportunityAttachment[]
}

/**
 * Owns the attachments list for a single opportunity. Tracks `uploading` state
 * so the UI can disable the upload button mid-flight, and wraps download in a
 * sign-URL fetch then a programmatic anchor click (Supabase signed URLs are
 * one-shot per click).
 *
 * Uses `$fetch` + a watcher rather than `useFetch` so we can re-fetch cleanly
 * when the modal opens with a different opportunity.
 */
export function useOpportunityAttachments(opportunityId: Ref<string | null>) {
  const toast = useToast()
  const uploading = ref(false)
  const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
  const data = ref<AttachmentsResponse>({ attachments: [] })

  async function refresh() {
    if (!opportunityId.value) {
      data.value = { attachments: [] }
      status.value = 'idle'
      return
    }
    status.value = 'pending'
    try {
      data.value = await $fetch<AttachmentsResponse>(
        `/api/opportunities/${opportunityId.value}/attachments`
      )
      status.value = 'success'
    } catch {
      data.value = { attachments: [] }
      status.value = 'error'
    }
  }

  watch(opportunityId, refresh, { immediate: true })

  function extractMessage(err: unknown, fallback: string) {
    return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  async function upload(file: File): Promise<boolean> {
    if (!opportunityId.value) return false
    uploading.value = true
    try {
      const body = new FormData()
      body.append('file', file)
      await $fetch(`/api/opportunities/${opportunityId.value}/attachments`, {
        method: 'POST',
        body,
      })
      toast.add({ title: 'Attachment uploaded', description: file.name, color: 'success' })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Upload failed',
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
      return false
    } finally {
      uploading.value = false
    }
  }

  async function download(attachment: OpportunityAttachment) {
    if (!opportunityId.value) return
    try {
      const { url: signed } = await $fetch<{ url: string }>(
        `/api/opportunities/${opportunityId.value}/attachments/${attachment.id}/download`
      )
      const a = document.createElement('a')
      a.href = signed
      a.click()
    } catch (err) {
      toast.add({
        title: 'Download failed',
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
    }
  }

  async function remove(attachment: OpportunityAttachment): Promise<boolean> {
    if (!opportunityId.value) return false
    try {
      await $fetch(`/api/opportunities/${opportunityId.value}/attachments/${attachment.id}`, {
        method: 'DELETE',
      })
      toast.add({ title: 'Attachment deleted', description: attachment.fileName, color: 'success' })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Delete failed',
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
      return false
    }
  }

  return { data, status, refresh, uploading, upload, download, remove }
}
