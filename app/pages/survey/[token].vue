<script setup lang="ts">
import type { QuestionType } from '@@/shared/schemas/mel'

definePageMeta({ layout: false })
const route = useRoute()
const token = route.params.token as string
const toast = useToast()

interface Question {
  id: string
  type: QuestionType
  prompt: string
  options: string[]
  required: boolean
}
interface Survey {
  evaluation: { title: string; description?: string | null; status: string }
  questions: Question[]
  closed: boolean
}

const { data, error } = await useFetch<Survey>(`/api/public/survey/${token}`, {
  key: `survey-${token}`,
})
useHead({ title: data.value ? `${data.value.evaluation.title} — Survey` : 'Survey' })

const respondentName = ref('')
const answers = reactive<Record<string, string>>({})
const submitting = ref(false)
const done = ref(false)

async function submit() {
  const missing = (data.value?.questions ?? []).filter((q) => q.required && !answers[q.id]?.trim())
  if (missing.length) {
    toast.add({ title: 'Please answer all required questions', color: 'warning' })
    return
  }
  submitting.value = true
  try {
    await $fetch(`/api/public/survey/${token}`, {
      method: 'POST',
      body: {
        respondentName: respondentName.value || null,
        answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
      },
    })
    done.value = true
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not submit', description: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-elevated/30">
    <header class="border-b border-default bg-default">
      <div class="mx-auto max-w-2xl px-4 py-4"><AppLogo variant="full" /></div>
    </header>
    <main class="mx-auto max-w-2xl px-4 py-8">
      <div
        v-if="error || data?.closed"
        class="rounded-xl border border-dashed border-default p-12 text-center"
      >
        <UIcon name="i-lucide-clipboard-x" class="size-10 text-muted" />
        <p class="mt-2 text-sm text-muted">This survey is closed or the link is invalid.</p>
      </div>

      <div
        v-else-if="done"
        class="rounded-xl border border-success/40 bg-success/5 p-12 text-center"
      >
        <UIcon name="i-lucide-check-circle" class="size-10 text-success" />
        <h1 class="mt-2 text-lg font-semibold text-default">Thank you</h1>
        <p class="text-sm text-muted">Your response has been recorded.</p>
      </div>

      <div v-else-if="data" class="space-y-5">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-default">
            {{ data.evaluation.title }}
          </h1>
          <p v-if="data.evaluation.description" class="mt-1 text-sm text-muted">
            {{ data.evaluation.description }}
          </p>
        </div>

        <div class="rounded-xl border border-default bg-default p-5">
          <UFormField label="Your name (optional)">
            <UInput v-model="respondentName" class="w-full" />
          </UFormField>
        </div>

        <div
          v-for="q in data.questions"
          :key="q.id"
          class="rounded-xl border border-default bg-default p-5"
        >
          <p class="mb-2 text-sm font-medium text-default">
            {{ q.prompt }} <span v-if="q.required" class="text-error">*</span>
          </p>
          <UTextarea v-if="q.type === 'text'" v-model="answers[q.id]" :rows="2" class="w-full" />
          <div v-else-if="q.type === 'scale'" class="flex gap-2">
            <label v-for="n in 5" :key="n" class="flex cursor-pointer flex-col items-center gap-1">
              <input v-model="answers[q.id]" type="radio" :value="String(n)" :name="q.id" />
              <span class="text-xs text-muted">{{ n }}</span>
            </label>
          </div>
          <div v-else class="space-y-1.5">
            <label
              v-for="o in q.options"
              :key="o"
              class="flex cursor-pointer items-center gap-2 text-sm text-default"
            >
              <input v-model="answers[q.id]" type="radio" :value="o" :name="q.id" /> {{ o }}
            </label>
          </div>
        </div>

        <UButton label="Submit response" size="lg" :loading="submitting" @click="submit" />
      </div>
    </main>
  </div>
</template>
