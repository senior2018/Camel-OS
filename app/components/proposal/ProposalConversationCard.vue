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
// Matching soft avatar tints (same hash → same person colour everywhere).
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
// Tinted bubble per person (matches their name/avatar colour) so in a 6-way
// chat you can tell who said what at a glance — not just by the name.
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
      class="max-h-96 min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted px-4 py-3 lg:max-h-none"
    >
      <p v-if="!messages.length" class="py-8 text-center text-sm text-muted">
        {{
          onlyDecisions ? 'No decisions recorded yet.' : 'No messages yet — start the conversation.'
        }}
      </p>

      <template v-for="m in messages" :key="m.id">
        <!-- System / workflow event — deliberately quiet: a small centred line,
             muted text, tiny amber icon for identity. Never competes with people. -->
        <div v-if="m.kind === 'system'" class="flex justify-center py-0.5">
          <span
            class="inline-flex max-w-[88%] items-center gap-1.5 rounded-full bg-default/70 px-2.5 py-1 text-center text-[11px] text-muted ring-1 ring-default/80"
          >
            <UIcon name="i-lucide-zap" class="size-3 shrink-0 text-warning" />
            <span>{{ m.body }} · {{ time(m.createdAt) }}</span>
          </span>
        </div>

        <!-- Chat message — WhatsApp-group style: mine right (solid primary),
             others left with a coloured avatar + named bubble. -->
        <div
          v-else
          class="flex items-end gap-2"
          :class="isMine(m) ? 'justify-end' : 'justify-start'"
        >
          <!-- avatar for others -->
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
