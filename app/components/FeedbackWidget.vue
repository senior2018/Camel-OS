<script setup lang="ts">
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_ICON,
  type FeedbackCategory,
} from '@@/shared/schemas/launch'

/**
 * S29 — an always-available way for pilot users to send feedback from any page.
 * Captures the current route so triage has context. Deliberately low-friction.
 */
const route = useRoute()
const toast = useToast()
const open = ref(false)
const category = ref<FeedbackCategory>('idea')
const message = ref('')
const sending = ref(false)

const catButtons = FEEDBACK_CATEGORIES.map((c) => ({ key: c, icon: FEEDBACK_CATEGORY_ICON[c] }))

async function send() {
  if (message.value.trim().length < 3) return
  sending.value = true
  try {
    await $fetch('/api/launch/feedback', {
      method: 'POST',
      body: { category: category.value, message: message.value.trim(), pageUrl: route.path },
    })
    toast.add({ title: 'Thank you — feedback sent', color: 'success' })
    open.value = false
    message.value = ''
    category.value = 'idea'
  } catch {
    toast.add({ title: 'Could not send feedback', color: 'error' })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div>
    <UButton
      icon="i-lucide-message-square-plus"
      color="primary"
      variant="solid"
      size="sm"
      class="fixed bottom-5 right-20 z-40 rounded-full shadow-lg"
      aria-label="Send feedback"
      @click="open = true"
    />
    <UModal v-model:open="open" title="Send feedback">
      <template #body>
        <div class="space-y-3">
          <div class="flex gap-2">
            <button
              v-for="c in catButtons"
              :key="c.key"
              type="button"
              class="flex flex-1 flex-col items-center gap-1 rounded-lg border p-2 text-xs capitalize transition-colors"
              :class="
                category === c.key
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-default text-muted hover:text-default'
              "
              @click="category = c.key"
            >
              <UIcon :name="c.icon" class="size-5" />{{ c.key }}
            </button>
          </div>
          <UTextarea
            v-model="message"
            :rows="4"
            placeholder="What's on your mind? Be as specific as you like."
            class="w-full"
            autofocus
          />
          <p class="text-xs text-muted">
            Sent from <code class="text-[11px]">{{ route.path }}</code>
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" />
          <UButton
            label="Send"
            :loading="sending"
            :disabled="message.trim().length < 3"
            @click="send"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
