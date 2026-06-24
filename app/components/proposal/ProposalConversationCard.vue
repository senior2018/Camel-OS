<script setup lang="ts">
const props = withDefaults(defineProps<{ proposalId: string; canPost?: boolean }>(), {
  canPost: true,
})

interface Message {
  id: string
  kind: 'message' | 'system'
  body: string
  eventType: string | null
  createdAt: string
  authorUserId: string | null
  authorFirstName: string | null
  authorLastName: string | null
}

const toast = useToast()
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)

const { data, refresh } = await useFetch<{ messages: Message[] }>(
  () => `/api/proposals/${props.proposalId}/messages`,
  { key: () => `proposal-messages-${props.proposalId}`, default: () => ({ messages: [] }) }
)

// Filter: full conversation vs. just the workflow decisions (the founder's ask).
const onlyDecisions = ref(false)
const DECISION_EVENTS = new Set(['review_decision', 'final_approval', 'status_change'])
const messages = computed(() => {
  const all = data.value?.messages ?? []
  return onlyDecisions.value
    ? all.filter((m) => m.kind === 'system' && DECISION_EVENTS.has(m.eventType ?? ''))
    : all
})

function authorName(m: Message): string {
  return [m.authorFirstName, m.authorLastName].filter(Boolean).join(' ') || 'User'
}
function isMine(m: Message): boolean {
  return m.authorUserId === currentUserId.value
}
// Stable per-author accent so people are visually distinguishable.
const NAME_COLORS = [
  'text-primary',
  'text-info',
  'text-success',
  'text-warning',
  'text-error',
  'text-secondary',
]
function nameColor(id: string | null): string {
  if (!id) return 'text-muted'
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return NAME_COLORS[h % NAME_COLORS.length]!
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
    await $fetch(`/api/proposals/${props.proposalId}/messages`, {
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
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Conversation</h3>
        <UButton
          :variant="onlyDecisions ? 'soft' : 'ghost'"
          :color="onlyDecisions ? 'primary' : 'neutral'"
          size="xs"
          icon="i-lucide-filter"
          :label="onlyDecisions ? 'Decisions only' : 'All messages'"
          @click="onlyDecisions = !onlyDecisions"
        />
      </div>
    </template>

    <!-- Message stream -->
    <div
      ref="listEl"
      class="max-h-96 min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 lg:max-h-none"
    >
      <p v-if="!messages.length" class="py-8 text-center text-sm text-muted">
        {{
          onlyDecisions ? 'No decisions recorded yet.' : 'No messages yet — start the conversation.'
        }}
      </p>

      <template v-for="m in messages" :key="m.id">
        <!-- System / workflow event -->
        <div v-if="m.kind === 'system'" class="flex justify-center">
          <span class="rounded-full bg-elevated/60 px-3 py-1 text-center text-xs text-muted">
            <UIcon name="i-lucide-zap" class="mr-1 inline size-3" />{{ m.body }} ·
            {{ time(m.createdAt) }}
          </span>
        </div>

        <!-- Chat message -->
        <div v-else class="flex" :class="isMine(m) ? 'justify-end' : 'justify-start'">
          <div class="max-w-[80%]">
            <div
              class="rounded-2xl px-3 py-2 text-sm"
              :class="
                isMine(m)
                  ? 'rounded-br-sm bg-primary/10 text-default'
                  : 'rounded-bl-sm bg-elevated/60 text-default'
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
      </template>
    </div>

    <!-- Composer -->
    <div v-if="canPost" class="flex items-end gap-2 border-t border-default p-3">
      <UTextarea
        v-model="draft"
        :rows="1"
        autoresize
        placeholder="Write a message…"
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
