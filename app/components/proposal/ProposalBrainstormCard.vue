<script setup lang="ts">
const props = withDefaults(defineProps<{ proposalId: string; canWrite?: boolean }>(), {
  canWrite: false,
})

interface BrainstormNote {
  id: string
  body: string
  createdAt: string
  createdByUserId: string | null
  authorFirstName: string | null
  authorLastName: string | null
}

const toast = useToast()
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)

const { data, refresh } = await useFetch<{ notes: BrainstormNote[] }>(
  () => `/api/proposals/${props.proposalId}/brainstorm`,
  { key: () => `proposal-brainstorm-${props.proposalId}`, default: () => ({ notes: [] }) }
)
const notes = computed(() => data.value?.notes ?? [])

const draft = ref('')
const saving = ref(false)

async function add() {
  if (!draft.value.trim()) return
  saving.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}/brainstorm`, {
      method: 'POST',
      body: { body: draft.value.trim() },
    })
    draft.value = ''
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not add note', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(noteId: string) {
  try {
    await $fetch(`/api/proposals/${props.proposalId}/brainstorm/${noteId}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not remove', description: msg, color: 'error' })
  }
}

function authorName(n: BrainstormNote): string {
  return [n.authorFirstName, n.authorLastName].filter(Boolean).join(' ') || 'User'
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Brainstorm board</h3>
        <span class="text-xs text-muted">{{ notes.length }} note(s)</span>
      </div>
    </template>

    <div class="space-y-3">
      <div v-if="canWrite" class="flex items-start gap-2">
        <UTextarea
          v-model="draft"
          :rows="2"
          placeholder="Capture an idea, angle, win theme or question…"
          class="w-full"
          @keydown.enter.meta="add"
        />
        <UButton
          size="sm"
          icon="i-lucide-plus"
          label="Add"
          :loading="saving"
          :disabled="!draft.trim()"
          @click="add"
        />
      </div>

      <div v-if="notes.length" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          v-for="n in notes"
          :key="n.id"
          class="group relative rounded-lg border border-default bg-warning/5 p-2.5"
        >
          <p class="whitespace-pre-wrap text-sm text-default">{{ n.body }}</p>
          <div class="mt-1.5 flex items-center justify-between">
            <span class="text-xs text-dimmed">{{ authorName(n) }}</span>
            <UButton
              v-if="canWrite || n.createdByUserId === currentUserId"
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="error"
              class="opacity-0 transition group-hover:opacity-100"
              aria-label="Remove note"
              @click="remove(n.id)"
            />
          </div>
        </div>
      </div>
      <p v-else class="text-sm text-muted">No brainstorming notes yet.</p>
    </div>
  </UCard>
</template>
