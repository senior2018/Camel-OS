<script setup lang="ts">
const props = withDefaults(
  defineProps<{ projectId: string; activityId: string; canPost?: boolean }>(),
  { canPost: true }
)

interface Message {
  id: string
  body: string
  createdAt: string
  authorUserId: string | null
  authorFirstName: string | null
  authorLastName: string | null
}

const toast = useToast()
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)

const { data, refresh } = await useFetch<{ comments: Message[] }>(
  () => `/api/projects/${props.projectId}/activities/${props.activityId}/comments`,
  {
    key: () => `activity-comments-${props.activityId}`,
    default: () => ({ comments: [] }),
  }
)
const messages = computed(() => data.value?.comments ?? [])

function authorName(m: Message): string {
  return [m.authorFirstName, m.authorLastName].filter(Boolean).join(' ') || 'User'
}
function isMine(m: Message): boolean {
  return m.authorUserId === currentUserId.value
}
const NAME_COLORS = [
  'text-primary',
  'text-info',
  'text-success',
  'text-warning',
  'text-error',
  'text-secondary',
]
const AVATAR_COLORS = [
  'bg-primary/15 text-primary',
  'bg-info/15 text-info',
  'bg-success/15 text-success',
  'bg-warning/15 text-warning',
  'bg-error/15 text-error',
  'bg-secondary/15 text-secondary',
]
function authorHash(id: string | null): number {
  if (!id) return 0
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}
function nameColor(id: string | null): string {
  if (!id) return 'text-muted'
  return NAME_COLORS[authorHash(id) % NAME_COLORS.length]!
}
function avatarColor(id: string | null): string {
  if (!id) return 'bg-elevated text-muted'
  return AVATAR_COLORS[authorHash(id) % AVATAR_COLORS.length]!
}
const BUBBLE_COLORS = [
  'bg-primary/10 ring-primary/25',
  'bg-info/10 ring-info/25',
  'bg-success/10 ring-success/25',
  'bg-warning/10 ring-warning/25',
  'bg-error/10 ring-error/25',
  'bg-secondary/10 ring-secondary/25',
]
function bubbleColor(id: string | null): string {
  if (!id) return 'bg-default ring-default'
  return BUBBLE_COLORS[authorHash(id) % BUBBLE_COLORS.length]!
}
function initials(m: Message): string {
  const a = (m.authorFirstName ?? '').charAt(0)
  const b = (m.authorLastName ?? '').charAt(0)
  return (a + b).toUpperCase() || authorName(m).charAt(0).toUpperCase() || '?'
}
function time(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const draft = ref('')
const sending = ref(false)
const listEl = ref<HTMLElement | null>(null)
function scrollToEnd() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}
watch(messages, scrollToEnd)
onMounted(scrollToEnd)

async function send() {
  const body = draft.value.trim()
  if (!body) return
  sending.value = true
  try {
    await $fetch(`/api/projects/${props.projectId}/activities/${props.activityId}/comments`, {
      method: 'POST',
      body: { body },
    })
    draft.value = ''
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not send', description: msg, color: 'error' })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <UCard :ui="{ body: 'flex min-h-0 flex-1 flex-col p-0' }">
    <template #header>
      <h3 class="text-sm font-semibold text-default">Progress &amp; conversation</h3>
    </template>

    <div
      ref="listEl"
      class="max-h-[28rem] min-h-64 flex-1 space-y-3 overflow-y-auto bg-muted px-4 py-3"
    >
      <p v-if="!messages.length" class="py-10 text-center text-sm text-muted">
        No updates yet — share progress or leave a comment.
      </p>

      <div
        v-for="m in messages"
        :key="m.id"
        class="flex items-end gap-2"
        :class="isMine(m) ? 'justify-end' : 'justify-start'"
      >
        <div
          v-if="!isMine(m)"
          class="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          :class="avatarColor(m.authorUserId)"
        >
          {{ initials(m) }}
        </div>
        <div class="max-w-[78%]">
          <div
            class="rounded-2xl px-3 py-2 text-sm shadow-sm"
            :class="
              isMine(m)
                ? 'rounded-br-sm bg-primary text-inverted'
                : ['rounded-bl-sm text-default ring-1', bubbleColor(m.authorUserId)]
            "
          >
            <p
              v-if="!isMine(m)"
              class="mb-0.5 text-xs font-semibold"
              :class="nameColor(m.authorUserId)"
            >
              {{ authorName(m) }}
            </p>
            <p class="whitespace-pre-wrap">{{ m.body }}</p>
          </div>
          <p class="mt-0.5 px-1 text-[10px] text-dimmed" :class="isMine(m) ? 'text-right' : ''">
            {{ time(m.createdAt) }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="canPost" class="flex items-end gap-2 border-t border-default p-3">
      <UTextarea
        v-model="draft"
        :rows="1"
        autoresize
        placeholder="Share a progress update or leave a comment…"
        class="flex-1"
        @keydown.enter.exact.prevent="send"
      />
      <UButton
        icon="i-lucide-send"
        :loading="sending"
        :disabled="!draft.trim()"
        aria-label="Send"
        @click="send"
      />
    </div>
  </UCard>
</template>
