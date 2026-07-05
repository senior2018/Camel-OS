<script setup lang="ts">
/**
 * Communications content conversation (CC). Mirrors the proposal
 * ProposalConversationCard: WhatsApp-group style — own messages right (solid
 * primary), others left with a coloured avatar + named bubble, system notes
 * centred. Same structure and position as the proposal conversation.
 */
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

const toast = useToast()
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)
const messages = computed(() => data.value?.comments ?? [])
// Same affordance as the proposal conversation: system notes (author-less) are
// the recorded review/approval decisions, so "Decisions only" filters to them.
const onlyDecisions = ref(false)
const shown = computed(() =>
  onlyDecisions.value ? messages.value.filter((c) => !c.authorUserId) : messages.value
)

const draft = ref('')
const posting = ref(false)
const listEl = ref<HTMLElement | null>(null)
function scrollToEnd() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}
watch(messages, scrollToEnd)
onMounted(scrollToEnd)

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

function authorName(c: Comment) {
  return [c.authorFirstName, c.authorLastName].filter(Boolean).join(' ') || 'User'
}
function isMine(c: Comment) {
  return c.authorUserId === currentUserId.value
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
function authorHash(id: string | null) {
  if (!id) return 0
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}
function nameColor(id: string | null) {
  return id ? NAME_COLORS[authorHash(id) % NAME_COLORS.length]! : 'text-muted'
}
function avatarColor(id: string | null) {
  return id ? AVATAR_COLORS[authorHash(id) % AVATAR_COLORS.length]! : 'bg-elevated text-muted'
}
// Tinted bubble per person so a 6-way chat is readable at a glance.
const BUBBLE_COLORS = [
  'bg-primary/10 ring-primary/25',
  'bg-info/10 ring-info/25',
  'bg-success/10 ring-success/25',
  'bg-warning/10 ring-warning/25',
  'bg-error/10 ring-error/25',
  'bg-secondary/10 ring-secondary/25',
]
function bubbleColor(id: string | null) {
  return id ? BUBBLE_COLORS[authorHash(id) % BUBBLE_COLORS.length]! : 'bg-default ring-default'
}
function initials(c: Comment) {
  const a = (c.authorFirstName ?? '').charAt(0)
  const b = (c.authorLastName ?? '').charAt(0)
  return (a + b).toUpperCase() || authorName(c).charAt(0).toUpperCase() || '?'
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
  <UCard :ui="{ body: 'flex min-h-0 flex-1 flex-col p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-default">Conversation</h3>
        <UButton
          size="xs"
          :variant="onlyDecisions ? 'soft' : 'ghost'"
          :color="onlyDecisions ? 'primary' : 'neutral'"
          icon="i-lucide-filter"
          :label="onlyDecisions ? 'Decisions only' : 'All messages'"
          @click="onlyDecisions = !onlyDecisions"
        />
      </div>
    </template>

    <div ref="listEl" class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted px-4 py-3">
      <p v-if="!shown.length" class="py-8 text-center text-sm text-muted">
        {{
          onlyDecisions ? 'No decisions recorded yet.' : 'No messages yet — start the conversation.'
        }}
      </p>

      <template v-for="c in shown" :key="c.id">
        <!-- System note — deliberately quiet: small centred line, muted text,
             tiny amber icon for identity. -->
        <div v-if="!c.authorUserId" class="flex justify-center py-0.5">
          <span
            class="inline-flex max-w-[88%] items-center gap-1.5 rounded-full bg-default/70 px-2.5 py-1 text-center text-[11px] text-muted ring-1 ring-default/80"
          >
            <UIcon name="i-lucide-zap" class="size-3 shrink-0 text-warning" />
            <span>{{ c.body }} · {{ when(c.createdAt) }}</span>
          </span>
        </div>

        <!-- Chat message -->
        <div
          v-else
          class="flex items-end gap-2"
          :class="isMine(c) ? 'justify-end' : 'justify-start'"
        >
          <div
            v-if="!isMine(c)"
            class="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            :class="avatarColor(c.authorUserId)"
          >
            {{ initials(c) }}
          </div>
          <div class="max-w-[78%]">
            <div
              class="rounded-2xl px-3 py-2 text-sm shadow-sm"
              :class="
                isMine(c)
                  ? 'rounded-br-sm bg-primary text-inverted'
                  : ['rounded-bl-sm text-default ring-1', bubbleColor(c.authorUserId)]
              "
            >
              <p
                v-if="!isMine(c)"
                class="mb-0.5 text-xs font-semibold"
                :class="nameColor(c.authorUserId)"
              >
                {{ authorName(c) }}
              </p>
              <p class="whitespace-pre-wrap">{{ c.body }}</p>
            </div>
            <p class="mt-0.5 px-1 text-[10px] text-dimmed" :class="isMine(c) ? 'text-right' : ''">
              {{ when(c.createdAt) }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <div v-if="canPost" class="flex items-end gap-2 border-t border-default p-3">
      <UTextarea
        v-model="draft"
        :rows="1"
        autoresize
        placeholder="Write a message…"
        class="flex-1"
        @keydown.enter.exact.prevent="post"
      />
      <UButton
        icon="i-lucide-send"
        :loading="posting"
        :disabled="!draft.trim()"
        aria-label="Send"
        @click="post"
      />
    </div>
  </UCard>
</template>
