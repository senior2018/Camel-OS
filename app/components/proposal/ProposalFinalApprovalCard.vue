<script setup lang="ts">
/**
 * P3.4 — final approver's decision via a popup (uniform with the reviewer and
 * outcome popups). Approve clears the proposal to submit; Reject stops it and
 * requires a reason. The decision posts to the conversation.
 */
const props = defineProps<{ proposalId: string }>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()
const open = ref(false)
const decision = ref<'approved' | 'rejected' | null>(null)
const note = ref('')
const saving = ref(false)
const needsReason = computed(() => decision.value === 'rejected')

function start() {
  decision.value = null
  note.value = ''
  open.value = true
}

async function submit() {
  if (!decision.value) {
    toast.add({ title: 'Pick a decision', color: 'warning' })
    return
  }
  if (needsReason.value && !note.value.trim()) {
    toast.add({ title: 'A reason is required to reject', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}/final-approval`, {
      method: 'POST',
      body: { decision: decision.value, note: note.value.trim() || null },
    })
    toast.add({
      title: decision.value === 'approved' ? 'Approved to submit' : 'Final rejection recorded',
      color: decision.value === 'approved' ? 'success' : 'error',
    })
    open.value = false
    emit('changed')
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not record decision', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <p class="text-sm text-default">All reviewers have aligned. Record your final decision.</p>
    <UButton icon="i-lucide-shield-check" label="Record decision" @click="start" />

    <UModal v-model:open="open" title="Final approval">
      <template #body>
        <div class="space-y-4">
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              class="rounded-lg border-2 p-3 text-left transition-all"
              :class="
                decision === 'approved'
                  ? 'border-success bg-success/5'
                  : 'border-default hover:border-default/80'
              "
              @click="decision = 'approved'"
            >
              <span class="block text-sm font-medium text-default">Approve to submit</span>
              <span class="block text-xs text-muted">Cleared for submission</span>
            </button>
            <button
              type="button"
              class="rounded-lg border-2 p-3 text-left transition-all"
              :class="
                decision === 'rejected'
                  ? 'border-error bg-error/5'
                  : 'border-default hover:border-default/80'
              "
              @click="decision = 'rejected'"
            >
              <span class="block text-sm font-medium text-default">Reject</span>
              <span class="block text-xs text-muted">Stop — reason required</span>
            </button>
          </div>

          <UFormField :label="needsReason ? 'Reason (required)' : 'Note (optional)'">
            <UTextarea
              v-model="note"
              :rows="3"
              placeholder="Posts into the proposal conversation…"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" />
          <UButton
            label="Submit decision"
            :loading="saving"
            :disabled="!decision || (needsReason && !note.trim())"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
