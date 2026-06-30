<script setup lang="ts">
import {
  FEEDBACK_RELATIONSHIPS,
  FEEDBACK_RELATIONSHIP_LABEL,
  REVIEW_STATUS_COLOR,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUSES,
  feedbackSchema,
  type FeedbackRelationship,
  type ReviewStatus,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const canEdit = computed(() => can.value('hr', 'update'))
const toast = useToast()

interface Review {
  id: string
  subjectUserId: string
  subjectFirstName: string | null
  subjectLastName: string | null
  periodLabel: string | null
  status: ReviewStatus
  overallRating: number | null
  summary: string | null
}
interface Feedback {
  id: string
  reviewerUserId: string
  firstName: string | null
  lastName: string | null
  relationship: FeedbackRelationship
  rating: number | null
  strengths: string | null
  improvements: string | null
  comments: string | null
}
const { data, refresh } = await useFetch<{ review: Review; feedback: Feedback[] }>(
  `/api/hr/reviews/${id}`,
  { key: `review-${id}` }
)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const subjectName = computed(
  () =>
    [data.value?.review.subjectFirstName, data.value?.review.subjectLastName]
      .filter(Boolean)
      .join(' ') || 'Staff'
)
useHead(() => ({ title: `Review — ${subjectName.value}` }))

const { data: staff } = useFetch<{
  items: { userId: string; firstName: string | null; lastName: string | null; email: string }[]
}>('/api/hr/employees', { key: 'hr-employees', default: () => ({ items: [] }) })
const staffItems = computed(() =>
  (staff.value?.items ?? []).map((s) => ({
    label: [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email,
    value: s.userId,
  }))
)
const statusItems = REVIEW_STATUSES.map((s) => ({
  label: REVIEW_STATUS_LABEL[s],
  value: s as string,
}))
const relItems = FEEDBACK_RELATIONSHIPS.map((r) => ({
  label: FEEDBACK_RELATIONSHIP_LABEL[r],
  value: r as string,
}))

const avgRating = computed(() => {
  const rs = (data.value?.feedback ?? []).map((f) => f.rating).filter((r): r is number => r != null)
  return rs.length ? (rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1) : '—'
})

async function patchReview(body: Record<string, unknown>) {
  const endpoint: string = `/api/hr/reviews/${id}`
  await $fetch(endpoint, { method: 'PATCH', body })
  await refresh()
}
const summary = ref('')
const overall = ref('')
watchEffect(() => {
  summary.value = data.value?.review.summary ?? ''
  overall.value =
    data.value?.review.overallRating != null ? String(data.value.review.overallRating) : ''
})
async function saveSummary() {
  await patchReview({
    summary: summary.value || null,
    overallRating: overall.value === '' ? null : Number(overall.value),
  })
  toast.add({ title: 'Review updated', color: 'success' })
}

// Add feedback
const open = ref(false)
const form = reactive({
  reviewerUserId: '',
  relationship: 'peer',
  rating: '',
  strengths: '',
  improvements: '',
  comments: '',
})
async function addFeedback() {
  const parsed = feedbackSchema.safeParse({ ...form, rating: form.rating || null })
  if (!parsed.success) {
    toast.add({ title: 'Pick a reviewer', color: 'warning' })
    return
  }
  try {
    await $fetch(`/api/hr/reviews/${id}/feedback`, { method: 'POST', body: parsed.data })
    open.value = false
    Object.assign(form, {
      reviewerUserId: '',
      relationship: 'peer',
      rating: '',
      strengths: '',
      improvements: '',
      comments: '',
    })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save feedback', description: msg, color: 'error' })
  }
}
const reviewerName = (f: Feedback) =>
  [f.firstName, f.lastName].filter(Boolean).join(' ') || 'Reviewer'
</script>

<template>
  <div v-if="data" class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Reviews"
          class="-ml-2"
          @click="navigateTo('/hr/reviews')"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight text-default">{{ subjectName }}</h1>
          <UBadge
            :color="REVIEW_STATUS_COLOR[data.review.status]"
            variant="subtle"
            :label="REVIEW_STATUS_LABEL[data.review.status]"
          />
        </div>
        <p class="text-sm text-muted">{{ data.review.periodLabel ?? 'Performance review' }}</p>
      </div>
      <USelect
        v-if="canEdit"
        :model-value="data.review.status"
        :items="statusItems"
        value-key="value"
        class="w-44"
        @update:model-value="(s: string) => patchReview({ status: s })"
      />
    </div>

    <!-- 360 summary stats -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Feedback</p>
        <p class="mt-1 text-2xl font-semibold text-default">{{ data.feedback.length }}</p>
      </div>
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Avg rating</p>
        <p class="mt-1 text-2xl font-semibold text-default">{{ avgRating }}</p>
      </div>
      <div class="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Overall</p>
        <p class="mt-1 text-2xl font-semibold text-primary">
          {{ data.review.overallRating ? `${data.review.overallRating}/5` : '—' }}
        </p>
      </div>
    </div>

    <div class="flex justify-end">
      <UButton
        v-if="canEdit"
        icon="i-lucide-message-square-plus"
        variant="soft"
        label="Add feedback"
        @click="open = true"
      />
    </div>

    <!-- Feedback list -->
    <p
      v-if="!data.feedback.length"
      class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted"
    >
      No feedback collected yet.
    </p>
    <UCard v-for="f in data.feedback" :key="f.id">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-default">{{ reviewerName(f) }}</span>
            <UBadge
              color="neutral"
              variant="subtle"
              size="xs"
              :label="FEEDBACK_RELATIONSHIP_LABEL[f.relationship]"
            />
          </div>
          <span v-if="f.rating" class="text-sm font-medium text-warning">{{ f.rating }}/5</span>
        </div>
      </template>
      <div class="space-y-2 text-sm">
        <div v-if="f.strengths">
          <p class="text-xs uppercase tracking-wide text-muted">Strengths</p>
          <p class="text-default">{{ f.strengths }}</p>
        </div>
        <div v-if="f.improvements">
          <p class="text-xs uppercase tracking-wide text-muted">Areas to improve</p>
          <p class="text-default">{{ f.improvements }}</p>
        </div>
        <div v-if="f.comments">
          <p class="text-xs uppercase tracking-wide text-muted">Comments</p>
          <p class="text-muted">{{ f.comments }}</p>
        </div>
      </div>
    </UCard>

    <!-- Overall summary (HR) -->
    <UCard v-if="canEdit">
      <template #header
        ><h3 class="text-sm font-semibold text-default">Overall assessment</h3></template
      >
      <div class="space-y-3">
        <UFormField label="Overall rating (1–5)"
          ><UInput v-model="overall" type="number" class="w-32"
        /></UFormField>
        <UFormField label="Summary"
          ><UTextarea v-model="summary" :rows="3" class="w-full"
        /></UFormField>
        <div class="flex justify-end">
          <UButton size="sm" label="Save assessment" @click="saveSummary" />
        </div>
      </div>
    </UCard>
    <UCard v-else-if="data.review.summary">
      <template #header
        ><h3 class="text-sm font-semibold text-default">Overall assessment</h3></template
      >
      <p class="whitespace-pre-line text-sm text-muted">{{ data.review.summary }}</p>
    </UCard>

    <UModal v-model:open="open" title="Add 360° feedback">
      <template #body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Reviewer" required
              ><USelect
                v-model="form.reviewerUserId"
                :items="staffItems"
                value-key="value"
                class="w-full"
                placeholder="Select…"
            /></UFormField>
            <UFormField label="Relationship"
              ><USelect
                v-model="form.relationship"
                :items="relItems"
                value-key="value"
                class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Rating (1–5)"
            ><UInput v-model="form.rating" type="number" class="w-32"
          /></UFormField>
          <UFormField label="Strengths"
            ><UTextarea v-model="form.strengths" :rows="2" class="w-full"
          /></UFormField>
          <UFormField label="Areas to improve"
            ><UTextarea v-model="form.improvements" :rows="2" class="w-full"
          /></UFormField>
          <UFormField label="Comments"
            ><UTextarea v-model="form.comments" :rows="2" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" /><UButton
            label="Save feedback"
            @click="addFeedback"
          /></div
      ></template>
    </UModal>
  </div>
</template>
