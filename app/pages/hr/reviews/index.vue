<script setup lang="ts">
import {
  REVIEW_STATUS_COLOR,
  REVIEW_STATUS_LABEL,
  reviewSchema,
  type ReviewStatus,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Performance Reviews — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canCreate = computed(() => can.value('hr', 'create'))
const toast = useToast()

interface Review {
  id: string
  subjectUserId: string
  firstName: string | null
  lastName: string | null
  periodLabel: string | null
  status: ReviewStatus
  overallRating: number | null
  feedbackCount: number
}
const { data } = await useFetch<{ items: Review[] }>('/api/hr/reviews', {
  key: 'reviews',
  default: () => ({ items: [] }),
})
const { data: staff } = useFetch<{
  items: { userId: string; firstName: string | null; lastName: string | null; email: string }[]
}>('/api/hr/employees', { key: 'hr-employees', default: () => ({ items: [] }) })
const staffItems = computed(() =>
  (staff.value?.items ?? []).map((s) => ({
    label: [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email,
    value: s.userId,
  }))
)

const open = ref(false)
const saving = ref(false)
const form = reactive({ subjectUserId: '', periodLabel: '' })
async function create() {
  const parsed = reviewSchema.safeParse(form)
  if (!parsed.success) {
    toast.add({ title: 'Pick a staff member', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const res = await $fetch<{ review: { id: string } }>('/api/hr/reviews', {
      method: 'POST',
      body: parsed.data,
    })
    open.value = false
    await navigateTo(`/hr/reviews/${res.review.id}`)
  } catch {
    toast.add({ title: 'Could not create review', color: 'error' })
  } finally {
    saving.value = false
  }
}
const subjectName = (r: Review) => [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Staff'
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Performance Reviews</h1>
        <p class="mt-1 text-sm text-muted">360° feedback cycles for your team.</p>
      </div>
      <div class="flex gap-2">
        <UButton
          to="/hr"
          variant="outline"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="People"
        />
        <UButton v-if="canCreate" icon="i-lucide-plus" label="New review" @click="open = true" />
      </div>
    </header>

    <p
      v-if="!data.items.length"
      class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
    >
      No reviews yet.
    </p>
    <div v-else class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Subject</th>
            <th class="px-4 py-2 font-medium">Period</th>
            <th class="px-4 py-2 font-medium">Feedback</th>
            <th class="px-4 py-2 font-medium">Rating</th>
            <th class="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="r in data.items"
            :key="r.id"
            class="cursor-pointer hover:bg-elevated/40"
            @click="navigateTo(`/hr/reviews/${r.id}`)"
          >
            <td class="px-4 py-2.5 font-medium text-default">{{ subjectName(r) }}</td>
            <td class="px-4 py-2.5 text-muted">{{ r.periodLabel ?? '—' }}</td>
            <td class="px-4 py-2.5 text-muted">{{ r.feedbackCount }}</td>
            <td class="px-4 py-2.5 text-muted">
              {{ r.overallRating ? `${r.overallRating}/5` : '—' }}
            </td>
            <td class="px-4 py-2.5">
              <UBadge
                :color="REVIEW_STATUS_COLOR[r.status]"
                variant="subtle"
                size="xs"
                :label="REVIEW_STATUS_LABEL[r.status]"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="open" title="New performance review">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Subject" required
            ><USelect
              v-model="form.subjectUserId"
              :items="staffItems"
              value-key="value"
              class="w-full"
              placeholder="Select staff…"
          /></UFormField>
          <UFormField label="Period"
            ><UInput v-model="form.periodLabel" placeholder="e.g. 2026 Annual"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" /><UButton
            label="Create"
            :loading="saving"
            @click="create"
          /></div
      ></template>
    </UModal>
  </div>
</template>
