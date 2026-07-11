<script setup lang="ts">
import {
  APPLICANT_STAGES,
  APPLICANT_STAGE_COLOR,
  APPLICANT_STAGE_LABEL,
  VACANCY_STATUSES,
  VACANCY_STATUS_LABEL,
  applicantSchema,
  type ApplicantStage,
  type VacancyStatus,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const canEdit = computed(() => can.value('hr', 'update'))
const toast = useToast()

interface Vacancy {
  id: string
  title: string
  department: string | null
  description: string | null
  location: string | null
  openings: number
  status: VacancyStatus
  closingDate: string | null
}
interface Applicant {
  id: string
  name: string
  email: string | null
  phone: string | null
  cvUrl: string | null
  stage: ApplicantStage
  rating: number | null
  notes: string | null
}
const { data, refresh } = await useFetch<{ vacancy: Vacancy; applicants: Applicant[] }>(
  `/api/hr/vacancies/${id}`,
  { key: `vacancy-${id}` }
)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
useHead(() => ({ title: `${data.value?.vacancy.title ?? 'Vacancy'} — Camel OS` }))

const statusItems = VACANCY_STATUSES.map((s) => ({
  label: VACANCY_STATUS_LABEL[s],
  value: s as string,
}))
const stageItems = APPLICANT_STAGES.map((s) => ({
  label: APPLICANT_STAGE_LABEL[s],
  value: s as string,
}))

async function setVacancyStatus(status: string) {
  await $fetch(`/api/hr/vacancies/${id}`, { method: 'PATCH', body: { status } })
  await refresh()
}

// Applicants grouped into a simple pipeline board.
const board = computed(() =>
  APPLICANT_STAGES.map((stage) => ({
    stage,
    items: (data.value?.applicants ?? []).filter((a) => a.stage === stage),
  }))
)

const open = ref(false)
const form = reactive({ name: '', email: '', phone: '', cvUrl: '', stage: 'applied', notes: '' })
async function addApplicant() {
  const parsed = applicantSchema.safeParse(form)
  if (!parsed.success) {
    toast.add({ title: 'A name is required', color: 'warning' })
    return
  }
  await $fetch(`/api/hr/vacancies/${id}/applicants`, { method: 'POST', body: parsed.data })
  open.value = false
  Object.assign(form, { name: '', email: '', phone: '', cvUrl: '', stage: 'applied', notes: '' })
  await refresh()
}
async function moveApplicant(a: Applicant, stage: string) {
  const endpoint: string = `/api/hr/applicants/${a.id}`
  await $fetch(endpoint, { method: 'PATCH', body: { stage } })
  await refresh()
}
async function rate(a: Applicant, rating: number) {
  const endpoint: string = `/api/hr/applicants/${a.id}`
  await $fetch(endpoint, { method: 'PATCH', body: { rating } })
  await refresh()
}
</script>

<template>
  <div v-if="data" class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Recruitment"
          class="-ml-2"
          @click="navigateTo('/hr/recruitment')"
        />
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-default">
          {{ data.vacancy.title }}
        </h1>
        <p class="text-sm text-muted">
          {{ [data.vacancy.department, data.vacancy.location].filter(Boolean).join(' · ') }} ·
          {{ data.vacancy.openings }} opening(s)
        </p>
      </div>
      <div class="flex items-center gap-2">
        <USelect
          v-if="canEdit"
          :model-value="data.vacancy.status"
          :items="statusItems"
          value-key="value"
          class="w-36"
          @update:model-value="setVacancyStatus"
        />
        <UButton
          v-if="canEdit"
          icon="i-lucide-user-plus"
          label="Add applicant"
          @click="open = true"
        />
      </div>
    </div>

    <p
      v-if="data.vacancy.description"
      class="whitespace-pre-line rounded-xl border border-default bg-default p-4 text-sm text-muted"
    >
      {{ data.vacancy.description }}
    </p>

    <!-- Pipeline -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="col in board"
        :key="col.stage"
        class="rounded-xl border border-default bg-elevated/20 p-3"
      >
        <div class="mb-2 flex items-center justify-between">
          <UBadge
            :color="APPLICANT_STAGE_COLOR[col.stage]"
            variant="subtle"
            size="xs"
            :label="APPLICANT_STAGE_LABEL[col.stage]"
          />
          <span class="text-xs text-muted">{{ col.items.length }}</span>
        </div>
        <div class="space-y-2">
          <div
            v-for="a in col.items"
            :key="a.id"
            class="rounded-lg border border-default bg-default p-2.5"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">{{ a.name }}</p>
                <p v-if="a.email" class="truncate text-xs text-muted">{{ a.email }}</p>
              </div>
              <a
                v-if="a.cvUrl"
                :href="a.cvUrl"
                target="_blank"
                rel="noopener"
                class="text-muted hover:text-primary"
                ><UIcon name="i-lucide-file-text" class="size-4"
              /></a>
            </div>
            <div class="mt-1.5 flex items-center gap-0.5">
              <button
                v-for="n in 5"
                :key="n"
                type="button"
                :disabled="!canEdit"
                @click="rate(a, n)"
              >
                <UIcon
                  :name="(a.rating ?? 0) >= n ? 'i-lucide-star' : 'i-lucide-star'"
                  class="size-3.5"
                  :class="(a.rating ?? 0) >= n ? 'text-warning' : 'text-muted/40'"
                />
              </button>
            </div>
            <USelect
              v-if="canEdit"
              :model-value="a.stage"
              :items="stageItems"
              value-key="value"
              size="xs"
              class="mt-2 w-full"
              @update:model-value="(s: string) => moveApplicant(a, s)"
            />
          </div>
          <p v-if="!col.items.length" class="py-2 text-center text-xs text-muted/60">—</p>
        </div>
      </div>
    </div>

    <UModal v-model:open="open" title="Add applicant">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required><UInput v-model="form.name" autofocus /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Email"><UInput v-model="form.email" type="email" /></UFormField>
            <UFormField label="Phone"><UInput v-model="form.phone" /></UFormField>
          </div>
          <UFormField label="CV link"
            ><UInput v-model="form.cvUrl" placeholder="https://…"
          /></UFormField>
          <UFormField label="Notes"
            ><UTextarea v-model="form.notes" :rows="2" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" /><UButton
            label="Add"
            @click="addApplicant"
          /></div
      ></template>
    </UModal>
  </div>
</template>
