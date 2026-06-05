<script setup lang="ts">
import {
  OPPORTUNITY_COMMENT_KIND_LABEL,
  type CreateOpportunityCommentPayload,
  type OpportunityCommentKind,
} from '@@/shared/schemas/opportunity-comment'

interface Comment {
  id: string
  kind: OpportunityCommentKind
  body: string
  attachmentUrl: string | null
  createdByUserId: string | null
  createdAt: string
  createdByFirstName: string | null
  createdByLastName: string | null
  createdByEmail: string | null
}

interface Props {
  opportunityId: string
  canPost: boolean
}

const props = defineProps<Props>()
const toast = useToast()
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)

const { data, refresh, status } = await useFetch<{ items: Comment[] }>(
  () => `/api/opportunities/${props.opportunityId}/comments`,
  { key: () => `opp-comments-${props.opportunityId}`, default: () => ({ items: [] }) }
)

const showForm = ref(false)
const submitting = ref(false)
const form = reactive<{
  kind: OpportunityCommentKind
  body: string
  attachmentUrl: string
}>({
  kind: 'comment',
  body: '',
  attachmentUrl: '',
})

function openComment() {
  form.kind = 'comment'
  form.body = ''
  form.attachmentUrl = ''
  showForm.value = true
}

function openUpdate() {
  form.kind = 'update'
  form.body = ''
  form.attachmentUrl = ''
  showForm.value = true
}

async function submit() {
  if (!form.body.trim()) return
  submitting.value = true
  try {
    const payload: CreateOpportunityCommentPayload = {
      kind: form.kind,
      body: form.body.trim(),
      attachmentUrl: form.attachmentUrl.trim() || null,
    }
    await $fetch(`/api/opportunities/${props.opportunityId}/comments`, {
      method: 'POST',
      body: payload,
    })
    toast.add({ title: 'Posted', color: 'success' })
    showForm.value = false
    await refresh()
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.'
    toast.add({ title: 'Could not post', description: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}

async function remove(commentId: string) {
  try {
    await $fetch(`/api/opportunities/${props.opportunityId}/comments/${commentId}`, {
      method: 'DELETE',
    })
    toast.add({ title: 'Removed', color: 'success' })
    await refresh()
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.'
    toast.add({ title: 'Could not remove', description: msg, color: 'error' })
  }
}

function authorLabel(c: Comment): string {
  return (
    [c.createdByFirstName, c.createdByLastName].filter(Boolean).join(' ') ||
    c.createdByEmail ||
    'Unknown'
  )
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

function kindColor(k: OpportunityCommentKind): 'primary' | 'neutral' {
  return k === 'update' ? 'primary' : 'neutral'
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-default">Comments &amp; updates</h3>
          <p class="mt-0.5 text-xs text-muted">
            Reviewer opinions and owner status updates. Comments left on a rejection explain why.
          </p>
        </div>
        <div v-if="canPost" class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-megaphone"
            label="Post update"
            @click="openUpdate"
          />
          <UButton
            size="xs"
            variant="outline"
            icon="i-lucide-message-square-plus"
            label="Add comment"
            @click="openComment"
          />
        </div>
      </div>
    </template>

    <div v-if="status === 'pending'" class="flex justify-center py-6">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
    </div>

    <div
      v-else-if="!data?.items.length"
      class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      No comments yet. Be the first to weigh in.
    </div>

    <ol v-else class="relative space-y-3 border-l border-default pl-6">
      <li v-for="c in data.items" :key="c.id" class="relative">
        <span
          class="absolute -left-[31px] top-1 flex size-5 items-center justify-center rounded-full border border-default bg-default"
        >
          <UIcon
            :name="c.kind === 'update' ? 'i-lucide-megaphone' : 'i-lucide-message-square'"
            class="size-3 text-muted"
          />
        </span>
        <div class="rounded-lg border border-default bg-default p-3">
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
            <UBadge
              variant="subtle"
              :color="kindColor(c.kind)"
              size="xs"
              :label="OPPORTUNITY_COMMENT_KIND_LABEL[c.kind]"
            />
            <span class="font-medium text-default">{{ authorLabel(c) }}</span>
            <span class="text-dimmed">·</span>
            <span>{{ formatDate(c.createdAt) }}</span>
            <UButton
              v-if="canPost && c.createdByUserId === currentUserId"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Delete"
              class="ml-auto"
              @click="remove(c.id)"
            />
          </div>
          <p class="mt-2 whitespace-pre-wrap text-sm text-default">{{ c.body }}</p>
          <a
            v-if="c.attachmentUrl"
            :href="c.attachmentUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <UIcon name="i-lucide-paperclip" class="size-3.5" />
            Attached file
          </a>
        </div>
      </li>
    </ol>

    <UModal
      v-model:open="showForm"
      :title="form.kind === 'update' ? 'Post status update' : 'Add a comment'"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField :label="form.kind === 'update' ? 'Update' : 'Comment'" required>
            <UTextarea
              v-model="form.body"
              :rows="4"
              :placeholder="
                form.kind === 'update'
                  ? 'e.g. Vendor confirmed budget; eligibility reviewed.'
                  : 'Share your view on this opportunity.'
              "
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Attach a link (optional)"
            hint="Paste a URL — Google Drive, Dropbox, etc."
          >
            <UInput v-model="form.attachmentUrl" placeholder="https://…" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showForm = false" />
          <UButton
            :loading="submitting"
            :disabled="!form.body.trim()"
            :label="form.kind === 'update' ? 'Post update' : 'Add comment'"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
