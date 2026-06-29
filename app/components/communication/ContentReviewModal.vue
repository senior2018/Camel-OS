<script setup lang="ts">
import type { ContentReviewDecision } from '@@/shared/schemas/communication'

/** CC-03 — a reviewer records approve / request-changes / reject + a comment. */
const props = defineProps<{ contentId: string }>()
const emit = defineEmits<{ decided: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const decision = ref<Exclude<ContentReviewDecision, 'pending'>>('approved')
const comment = ref('')
const submitting = ref(false)

interface Option {
  value: Exclude<ContentReviewDecision, 'pending'>
  label: string
  desc: string
  icon: string
  active: string
}
const options: Option[] = [
  {
    value: 'approved',
    label: 'Approve',
    desc: 'Ready to publish',
    icon: 'i-lucide-check-circle',
    active: 'border-success ring-1 ring-success bg-success/5',
  },
  {
    value: 'changes_requested',
    label: 'Request changes',
    desc: 'Send back for edits',
    icon: 'i-lucide-rotate-ccw',
    active: 'border-warning ring-1 ring-warning bg-warning/5',
  },
  {
    value: 'rejected',
    label: 'Reject',
    desc: 'Should not be published',
    icon: 'i-lucide-x-circle',
    active: 'border-error ring-1 ring-error bg-error/5',
  },
]
const needsComment = computed(() => decision.value !== 'approved')

async function submit() {
  if (needsComment.value && !comment.value.trim()) {
    toast.add({ title: 'A comment is required to request changes or reject', color: 'warning' })
    return
  }
  submitting.value = true
  try {
    await $fetch(`/api/communications/content/${props.contentId}/review`, {
      method: 'POST',
      body: { decision: decision.value, comment: comment.value.trim() || null },
    })
    toast.add({ title: 'Review submitted', color: 'success' })
    open.value = false
    comment.value = ''
    decision.value = 'approved'
    emit('decided')
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not submit review', description: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Review content">
    <template #body>
      <div class="space-y-3">
        <button
          v-for="o in options"
          :key="o.value"
          class="flex w-full items-center gap-3 rounded-lg border border-default p-3 text-left transition-colors hover:bg-elevated/40"
          :class="decision === o.value ? o.active : ''"
          @click="decision = o.value"
        >
          <UIcon :name="o.icon" class="size-5 text-muted" />
          <div>
            <p class="text-sm font-medium text-default">{{ o.label }}</p>
            <p class="text-xs text-muted">{{ o.desc }}</p>
          </div>
        </button>
        <UFormField :label="needsComment ? 'Comment (required)' : 'Comment (optional)'">
          <UTextarea
            v-model="comment"
            :rows="3"
            placeholder="Explain your decision…"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" />
        <UButton label="Submit review" :loading="submitting" @click="submit" />
      </div>
    </template>
  </UModal>
</template>
