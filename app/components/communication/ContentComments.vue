<script setup lang="ts">
const props = defineProps<{ contentId: string; canPost: boolean }>()

interface Comment {
  id: string
  body: string
  authorUserId: string | null
  authorFirstName: string | null
  authorLastName: string | null
  createdAt: string
}

const { data, refresh } = useFetch<{ comments: Comment[] }>(
  `/api/communications/content/${props.contentId}/comments`,
  { key: `content-comments-${props.contentId}`, default: () => ({ comments: [] }) }
)
defineExpose({ refresh })

const draft = ref('')
const posting = ref(false)
const toast = useToast()

async function post() {
  if (!draft.value.trim()) return
  posting.value = true
  try {
    await $fetch(`/api/communications/content/${props.contentId}/comments`, {
      method: 'POST',
      body: { body: draft.value.trim() },
    })
    draft.value = ''
    await refresh()
  } catch {
    toast.add({ title: 'Could not post comment', color: 'error' })
  } finally {
    posting.value = false
  }
}
function name(c: Comment) {
  return [c.authorFirstName, c.authorLastName].filter(Boolean).join(' ') || 'User'
}
function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-semibold text-default">Discussion</h3>
    </template>
    <div class="space-y-3">
      <ul v-if="data?.comments.length" class="space-y-3">
        <li v-for="c in data.comments" :key="c.id">
          <div v-if="!c.authorUserId" class="text-center text-xs text-muted">
            <UIcon name="i-lucide-info" class="inline size-3" /> {{ c.body }} ·
            {{ when(c.createdAt) }}
          </div>
          <div v-else class="rounded-lg border border-default p-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-default">{{ name(c) }}</span>
              <span class="text-xs text-dimmed">{{ when(c.createdAt) }}</span>
            </div>
            <p class="mt-1 whitespace-pre-wrap text-sm text-default">{{ c.body }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="py-2 text-center text-sm text-muted">No comments yet.</p>

      <div v-if="canPost" class="flex gap-2">
        <UInput
          v-model="draft"
          placeholder="Write a comment…"
          class="flex-1"
          @keydown.enter="post"
        />
        <UButton icon="i-lucide-send" aria-label="Post" :loading="posting" @click="post" />
      </div>
    </div>
  </UCard>
</template>
