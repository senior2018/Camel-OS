<script setup lang="ts">
const props = withDefaults(defineProps<{ proposalId: string; canWrite?: boolean }>(), {
  canWrite: false,
})

interface Section {
  id: string
  title: string
  body: string | null
  sortOrder: number
  assignedToUserId: string | null
  assignedToFirstName: string | null
  assignedToLastName: string | null
  updatedAt: string
  updatedByUserId: string | null
}

const toast = useToast()
const { data, refresh } = await useFetch<{ sections: Section[] }>(
  () => `/api/proposals/${props.proposalId}/sections`,
  { key: () => `proposal-sections-${props.proposalId}`, default: () => ({ sections: [] }) }
)
const sections = computed(() => data.value?.sections ?? [])

interface TeamMember {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}
const { data: teamData } = await useFetch<{ members: TeamMember[] }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})
const ownerItems = computed(() => [
  { label: 'Unassigned', value: null as string | null },
  ...(teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id as string | null,
  })),
])
function memberName(userId: string | null): string | null {
  if (!userId) return null
  const m = (teamData.value?.members ?? []).find((x) => x.id === userId)
  return m ? [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email : null
}

// Local edit buffers keyed by section id.
const drafts = reactive<Record<string, { body: string; assignedToUserId: string | null }>>({})
watch(
  sections,
  (list) => {
    for (const s of list) {
      if (!drafts[s.id]) drafts[s.id] = { body: s.body ?? '', assignedToUserId: s.assignedToUserId }
    }
  },
  { immediate: true }
)

const busy = ref(false)
async function api(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
) {
  busy.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}/sections${path}`, {
      method: method as 'POST',
      body,
    })
    await refresh()
    return true
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
    return false
  } finally {
    busy.value = false
  }
}

const newTitle = ref('')
async function addSection() {
  if (!newTitle.value.trim()) return
  if (await api('', 'POST', { title: newTitle.value.trim() })) newTitle.value = ''
}
async function seedTemplate() {
  await api('', 'POST', { seedTemplate: true })
}
async function saveSection(s: Section) {
  const d = drafts[s.id]
  if (!d) return
  const ok = await api(`/${s.id}`, 'PATCH', {
    body: d.body,
    assignedToUserId: d.assignedToUserId,
    expectedUpdatedAt: s.updatedAt,
  })
  if (ok) {
    toast.add({ title: 'Section saved', color: 'success' })
    if (openHistory.value === s.id) await loadHistory(s.id)
  }
}

// ── PM-03: per-section save history ──
interface Version {
  id: string
  title: string
  body: string | null
  createdAt: string
  savedByFirstName: string | null
  savedByLastName: string | null
}
const openHistory = ref<string | null>(null)
const historyBySection = reactive<Record<string, Version[]>>({})
async function loadHistory(sectionId: string) {
  try {
    const res = await $fetch<{ versions: Version[] }>(
      `/api/proposals/${props.proposalId}/sections/${sectionId}/versions`
    )
    historyBySection[sectionId] = res.versions
  } catch {
    historyBySection[sectionId] = []
  }
}
async function toggleHistory(sectionId: string) {
  if (openHistory.value === sectionId) {
    openHistory.value = null
    return
  }
  openHistory.value = sectionId
  if (!historyBySection[sectionId]) await loadHistory(sectionId)
}
function restoreVersion(sectionId: string, v: Version) {
  const d = drafts[sectionId]
  if (d) d.body = v.body ?? ''
  toast.add({
    title: 'Loaded into editor',
    description: 'Review, then Save section.',
    color: 'info',
  })
}
function savedByName(v: Version): string {
  return [v.savedByFirstName, v.savedByLastName].filter(Boolean).join(' ') || 'User'
}
async function deleteSection(s: Section) {
  await api(`/${s.id}`, 'DELETE')
}

// ── PM-06: per-section comments (any viewer can comment) ──
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)

interface Comment {
  id: string
  sectionId: string | null
  parentCommentId: string | null
  body: string
  createdAt: string
  createdByUserId: string | null
  authorFirstName: string | null
  authorLastName: string | null
  authorEmail: string | null
}
const { data: commentData, refresh: refreshComments } = await useFetch<{ comments: Comment[] }>(
  () => `/api/proposals/${props.proposalId}/comments`,
  { key: () => `proposal-comments-${props.proposalId}`, default: () => ({ comments: [] }) }
)
// Top-level comments for a section (threaded replies hang off these).
function commentsFor(sectionId: string): Comment[] {
  return (commentData.value?.comments ?? []).filter(
    (c) => c.sectionId === sectionId && !c.parentCommentId
  )
}
function repliesFor(commentId: string): Comment[] {
  return (commentData.value?.comments ?? []).filter((c) => c.parentCommentId === commentId)
}
function authorName(c: Comment): string {
  return [c.authorFirstName, c.authorLastName].filter(Boolean).join(' ') || c.authorEmail || 'User'
}

const commentDrafts = reactive<Record<string, string>>({})
// Which comment's reply box is open, plus per-comment reply drafts.
const replyingTo = ref<string | null>(null)
const replyDrafts = reactive<Record<string, string>>({})
function toggleReply(commentId: string) {
  replyingTo.value = replyingTo.value === commentId ? null : commentId
}

async function postComment(sectionId: string, parentCommentId: string | null = null) {
  const draftKey = parentCommentId ?? sectionId
  const store = parentCommentId ? replyDrafts : commentDrafts
  const body = (store[draftKey] ?? '').trim()
  if (!body) return
  try {
    await $fetch(`/api/proposals/${props.proposalId}/comments`, {
      method: 'POST',
      body: { sectionId, parentCommentId, body },
    })
    store[draftKey] = ''
    if (parentCommentId) replyingTo.value = null
    await refreshComments()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not post comment', description: msg, color: 'error' })
  }
}
async function deleteComment(commentId: string) {
  try {
    await $fetch(`/api/proposals/${props.proposalId}/comments/${commentId}`, { method: 'DELETE' })
    await refreshComments()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not delete', description: msg, color: 'error' })
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Proposal sections</h3>
        <span class="text-xs text-muted">{{ sections.length }} section(s)</span>
      </div>
    </template>

    <div class="space-y-4">
      <div
        v-if="!sections.length"
        class="rounded-lg border border-dashed border-default p-6 text-center"
      >
        <p class="text-sm text-muted">No sections yet.</p>
        <div v-if="canWrite" class="mt-3 flex justify-center gap-2">
          <UButton
            size="sm"
            icon="i-lucide-layout-template"
            label="Use template"
            :loading="busy"
            @click="seedTemplate"
          />
        </div>
      </div>

      <div v-for="s in sections" :key="s.id" class="rounded-lg border border-default p-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <p class="text-sm font-medium text-default">{{ s.title }}</p>
          <div v-if="canWrite" class="flex items-center gap-2">
            <USelect
              v-model="drafts[s.id]!.assignedToUserId"
              :items="ownerItems"
              value-key="value"
              size="xs"
              class="w-44"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              :loading="busy"
              @click="deleteSection(s)"
            />
          </div>
          <UBadge
            v-else-if="s.assignedToUserId"
            variant="subtle"
            color="neutral"
            size="xs"
            :label="[s.assignedToFirstName, s.assignedToLastName].filter(Boolean).join(' ')"
          />
        </div>
        <UTextarea
          v-if="canWrite"
          v-model="drafts[s.id]!.body"
          :rows="4"
          placeholder="Write this section…"
          class="w-full"
        />
        <p v-else-if="s.body" class="whitespace-pre-wrap text-sm text-default">{{ s.body }}</p>
        <p v-else class="text-sm text-muted">Empty.</p>
        <div class="mt-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 text-xs text-dimmed">
            <span v-if="memberName(s.updatedByUserId)">
              Edited by {{ memberName(s.updatedByUserId) }} ·
              {{
                new Date(s.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              }}
            </span>
            <UButton
              size="xs"
              variant="link"
              color="neutral"
              icon="i-lucide-history"
              :label="openHistory === s.id ? 'Hide history' : 'History'"
              @click="toggleHistory(s.id)"
            />
          </div>
          <UButton
            v-if="canWrite"
            size="xs"
            label="Save section"
            :loading="busy"
            @click="saveSection(s)"
          />
        </div>

        <!-- PM-03 — save history -->
        <div v-if="openHistory === s.id" class="mt-2 space-y-1.5 border-t border-default pt-2">
          <p v-if="!historyBySection[s.id]?.length" class="text-xs text-muted">
            No saved revisions yet.
          </p>
          <div
            v-for="v in historyBySection[s.id] ?? []"
            :key="v.id"
            class="rounded-md bg-elevated/40 px-2 py-1.5 text-xs"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-dimmed">
                {{ savedByName(v) }} ·
                {{
                  new Date(v.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }}
              </span>
              <UButton
                v-if="canWrite"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-rotate-ccw"
                label="Restore"
                @click="restoreVersion(s.id, v)"
              />
            </div>
            <p class="mt-0.5 line-clamp-3 whitespace-pre-wrap text-muted">
              {{ v.body || '(empty)' }}
            </p>
          </div>
        </div>

        <!-- PM-06 — section comments -->
        <div class="mt-3 space-y-2 border-t border-default pt-2">
          <div
            v-for="c in commentsFor(s.id)"
            :key="c.id"
            class="rounded-md bg-elevated/40 px-2 py-1.5 text-xs"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-default">{{ authorName(c) }}</span>
              <div class="flex items-center gap-2">
                <span class="text-dimmed">{{
                  new Date(c.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })
                }}</span>
                <UButton
                  icon="i-lucide-reply"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  aria-label="Reply"
                  @click="toggleReply(c.id)"
                />
                <UButton
                  v-if="c.createdByUserId === currentUserId"
                  icon="i-lucide-x"
                  size="xs"
                  variant="ghost"
                  color="error"
                  aria-label="Delete comment"
                  @click="deleteComment(c.id)"
                />
              </div>
            </div>
            <p class="mt-0.5 whitespace-pre-wrap text-muted">{{ c.body }}</p>

            <!-- Threaded replies -->
            <div
              v-for="r in repliesFor(c.id)"
              :key="r.id"
              class="mt-1.5 ml-3 border-l border-default pl-2"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium text-default">{{ authorName(r) }}</span>
                <UButton
                  v-if="r.createdByUserId === currentUserId"
                  icon="i-lucide-x"
                  size="xs"
                  variant="ghost"
                  color="error"
                  aria-label="Delete reply"
                  @click="deleteComment(r.id)"
                />
              </div>
              <p class="mt-0.5 whitespace-pre-wrap text-muted">{{ r.body }}</p>
            </div>

            <!-- Reply box -->
            <div v-if="replyingTo === c.id" class="mt-1.5 ml-3 flex items-center gap-2">
              <UInput
                v-model="replyDrafts[c.id]"
                size="xs"
                placeholder="Write a reply…"
                class="flex-1"
                autofocus
                @keyup.enter="postComment(s.id, c.id)"
              />
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-send"
                aria-label="Post reply"
                :disabled="!(replyDrafts[c.id] ?? '').trim()"
                @click="postComment(s.id, c.id)"
              />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UInput
              v-model="commentDrafts[s.id]"
              size="xs"
              placeholder="Add a comment…"
              class="flex-1"
              @keyup.enter="postComment(s.id)"
            />
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-send"
              aria-label="Post"
              :disabled="!(commentDrafts[s.id] ?? '').trim()"
              @click="postComment(s.id)"
            />
          </div>
        </div>
      </div>

      <div
        v-if="canWrite && sections.length"
        class="flex items-end gap-2 border-t border-default pt-3"
      >
        <UFormField label="Add a section" class="flex-1">
          <UInput v-model="newTitle" placeholder="Section title…" class="w-full" />
        </UFormField>
        <UButton
          size="sm"
          label="Add"
          :loading="busy"
          :disabled="!newTitle.trim()"
          @click="addSection"
        />
      </div>
    </div>
  </UCard>
</template>
