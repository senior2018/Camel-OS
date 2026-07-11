<script setup lang="ts">
import {
  EVALUATION_STATUS_COLOR,
  EVALUATION_STATUS_LABEL,
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  type EvaluationStatus,
  type QuestionType,
} from '@@/shared/schemas/mel'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const canEdit = computed(() => can.value('mel', 'update'))
const toast = useToast()

interface Question {
  id: string
  type: QuestionType
  prompt: string
  options: string[]
  required: boolean
  orderIndex: number
}
interface Evaluation {
  id: string
  title: string
  description: string | null
  status: EvaluationStatus
  publicToken: string | null
}
interface Resp {
  id: string
  respondentName: string | null
  submittedAt: string
}
interface Answer {
  questionId: string
  value: string | null
}

const { data, refresh } = await useFetch<{
  evaluation: Evaluation
  questions: Question[]
  responses: Resp[]
  answers: Answer[]
}>(`/api/mel/evaluations/${id}`, { key: `evaluation-${id}` })
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
useHead(() => ({ title: `${data.value?.evaluation.title ?? 'Evaluation'} — Camel OS` }))

const surveyUrl = computed(() =>
  data.value?.evaluation.publicToken && import.meta.client
    ? `${window.location.origin}/survey/${data.value.evaluation.publicToken}`
    : ''
)

// ── Question builder ──
const questions = ref<
  { type: QuestionType; prompt: string; options: string[]; required: boolean }[]
>([])
watchEffect(() => {
  questions.value = (data.value?.questions ?? []).map((q) => ({
    type: q.type,
    prompt: q.prompt,
    options: [...q.options],
    required: q.required,
  }))
})
const typeItems = QUESTION_TYPES.map((t) => ({ label: QUESTION_TYPE_LABEL[t], value: t as string }))
function addQuestion() {
  questions.value.push({ type: 'text', prompt: '', options: [], required: false })
}
const savingQ = ref(false)
async function saveQuestions() {
  savingQ.value = true
  try {
    await $fetch(`/api/mel/evaluations/${id}/questions`, {
      method: 'PUT',
      body: {
        questions: questions.value
          .filter((q) => q.prompt.trim())
          .map((q) => ({
            type: q.type,
            prompt: q.prompt.trim(),
            options: q.type === 'multiple_choice' ? q.options.filter((o) => o.trim()) : [],
            required: q.required,
          })),
      },
    })
    toast.add({ title: 'Questions saved', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    savingQ.value = false
  }
}

async function setStatus(s: EvaluationStatus) {
  try {
    await $fetch(`/api/mel/evaluations/${id}`, { method: 'PATCH', body: { status: s } })
    await refresh()
  } catch {
    toast.add({ title: 'Could not update status', color: 'error' })
  }
}
function copyLink() {
  if (surveyUrl.value && import.meta.client) {
    navigator.clipboard.writeText(surveyUrl.value)
    toast.add({ title: 'Survey link copied', color: 'success' })
  }
}

// ── Response aggregation ──
function answersFor(qid: string) {
  return (data.value?.answers ?? []).filter((a) => a.questionId === qid).map((a) => a.value ?? '')
}
function choiceCounts(q: Question) {
  const vals = answersFor(q.id)
  return q.options.map((o) => ({ option: o, count: vals.filter((v) => v === o).length }))
}
function scaleAverage(q: Question) {
  const nums = answersFor(q.id)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—'
}
const tab = ref<'build' | 'responses'>('build')
</script>

<template>
  <div v-if="data" class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="All evaluations"
          class="-ml-2"
          @click="navigateTo('/evaluations')"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight text-default">
            {{ data.evaluation.title }}
          </h1>
          <UBadge
            :color="EVALUATION_STATUS_COLOR[data.evaluation.status]"
            variant="subtle"
            :label="EVALUATION_STATUS_LABEL[data.evaluation.status]"
          />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="canEdit && data.evaluation.status === 'draft'"
          icon="i-lucide-send"
          label="Open for responses"
          @click="setStatus('open')"
        />
        <UButton
          v-if="canEdit && data.evaluation.status === 'open'"
          icon="i-lucide-lock"
          variant="outline"
          color="neutral"
          label="Close"
          @click="setStatus('closed')"
        />
      </div>
    </div>

    <!-- Distribution link -->
    <div
      v-if="data.evaluation.status === 'open' && surveyUrl"
      class="flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-3"
    >
      <UIcon name="i-lucide-link" class="size-4 text-success" />
      <span class="text-sm text-default">Share this link to collect responses:</span>
      <UInput :model-value="surveyUrl" readonly size="sm" class="min-w-0 flex-1" />
      <UButton size="sm" variant="soft" icon="i-lucide-copy" label="Copy" @click="copyLink" />
    </div>

    <div class="flex gap-1 border-b border-default">
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium"
        :class="tab === 'build' ? 'border-primary text-primary' : 'border-transparent text-muted'"
        @click="tab = 'build'"
      >
        Questions
      </button>
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium"
        :class="
          tab === 'responses' ? 'border-primary text-primary' : 'border-transparent text-muted'
        "
        @click="tab = 'responses'"
      >
        Responses ({{ data.responses.length }})
      </button>
    </div>

    <!-- Builder -->
    <div v-show="tab === 'build'" class="space-y-3">
      <UCard v-for="(q, i) in questions" :key="i">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <UInput
              v-model="q.prompt"
              :disabled="!canEdit"
              placeholder="Question prompt"
              class="flex-1"
            />
            <USelect
              v-model="q.type"
              :items="typeItems"
              value-key="value"
              :disabled="!canEdit"
              class="w-40"
            />
            <UButton
              v-if="canEdit"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Remove"
              @click="questions.splice(i, 1)"
            />
          </div>
          <div v-if="q.type === 'multiple_choice'" class="pl-2">
            <UTextarea
              :model-value="q.options.join('\n')"
              :disabled="!canEdit"
              :rows="3"
              class="w-full"
              placeholder="One option per line"
              @update:model-value="(v: string) => (q.options = v.split('\n'))"
            />
          </div>
          <label class="flex items-center gap-2 text-xs text-muted"
            ><UCheckbox v-model="q.required" :disabled="!canEdit" /> Required</label
          >
        </div>
      </UCard>
      <div v-if="canEdit" class="flex items-center justify-between">
        <UButton
          size="sm"
          variant="soft"
          icon="i-lucide-plus"
          label="Add question"
          @click="addQuestion"
        />
        <UButton size="sm" label="Save questions" :loading="savingQ" @click="saveQuestions" />
      </div>
      <p
        v-if="!questions.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No questions yet.
      </p>
    </div>

    <!-- Responses -->
    <div v-show="tab === 'responses'" class="space-y-4">
      <p
        v-if="!data.responses.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No responses yet.
      </p>
      <UCard v-for="q in data.questions" :key="q.id">
        <template #header
          ><h3 class="text-sm font-semibold text-default">{{ q.prompt }}</h3></template
        >
        <div v-if="q.type === 'multiple_choice'" class="space-y-1.5">
          <div v-for="c in choiceCounts(q)" :key="c.option" class="text-sm">
            <div class="flex justify-between">
              <span class="text-default">{{ c.option }}</span
              ><span class="text-muted">{{ c.count }}</span>
            </div>
            <div class="mt-0.5 h-1.5 rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-primary"
                :style="{
                  width: `${data.responses.length ? (c.count / data.responses.length) * 100 : 0}%`,
                }"
              />
            </div>
          </div>
        </div>
        <div v-else-if="q.type === 'scale'" class="text-sm text-default">
          Average: <span class="font-semibold text-primary">{{ scaleAverage(q) }}</span> / 5
        </div>
        <ul v-else class="space-y-1 text-sm text-default">
          <li
            v-for="(a, i) in answersFor(q.id).filter(Boolean)"
            :key="i"
            class="rounded border border-default px-2 py-1"
          >
            {{ a }}
          </li>
          <li v-if="!answersFor(q.id).filter(Boolean).length" class="text-muted">
            No text responses.
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
