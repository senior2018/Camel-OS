<script setup lang="ts">
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABEL,
  VACANCY_STATUS_COLOR,
  VACANCY_STATUS_LABEL,
  vacancySchema,
  type EmploymentType,
  type VacancyStatus,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Recruitment — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canCreate = computed(() => can.value('hr', 'create'))
const toast = useToast()

interface Vacancy {
  id: string
  title: string
  department: string | null
  employmentType: EmploymentType
  location: string | null
  openings: number
  status: VacancyStatus
  closingDate: string | null
  applicantCount: number
}
const { data } = await useFetch<{ items: Vacancy[] }>('/api/hr/vacancies', {
  key: 'vacancies',
  default: () => ({ items: [] }),
})

const open = ref(false)
const saving = ref(false)
const form = reactive({
  title: '',
  department: '',
  employmentType: 'full_time' as EmploymentType,
  location: '',
  openings: '1',
  description: '',
  closingDate: '',
})
const typeItems = EMPLOYMENT_TYPES.map((t) => ({
  label: EMPLOYMENT_TYPE_LABEL[t],
  value: t as string,
}))
async function create() {
  const parsed = vacancySchema.safeParse({ ...form, openings: form.openings })
  if (!parsed.success) {
    toast.add({ title: 'A title is required', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const res = await $fetch<{ vacancy: { id: string } }>('/api/hr/vacancies', {
      method: 'POST',
      body: parsed.data,
    })
    open.value = false
    await navigateTo(`/hr/recruitment/${res.vacancy.id}`)
  } catch {
    toast.add({ title: 'Could not create vacancy', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Recruitment</h1>
        <p class="mt-1 text-sm text-muted">Job vacancies and applicant pipelines.</p>
      </div>
      <div class="flex gap-2">
        <UButton
          to="/hr"
          variant="outline"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="People"
        />
        <UButton v-if="canCreate" icon="i-lucide-plus" label="Post vacancy" @click="open = true" />
      </div>
    </header>

    <p
      v-if="!data.items.length"
      class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
    >
      No vacancies yet.
    </p>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <button
        v-for="v in data.items"
        :key="v.id"
        type="button"
        class="rounded-xl border border-default bg-default p-4 text-left transition-colors hover:border-primary/50"
        @click="navigateTo(`/hr/recruitment/${v.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-semibold text-default">{{ v.title }}</p>
            <p class="text-xs text-muted">
              {{
                [v.department, EMPLOYMENT_TYPE_LABEL[v.employmentType], v.location]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </p>
          </div>
          <UBadge
            :color="VACANCY_STATUS_COLOR[v.status]"
            variant="subtle"
            size="xs"
            :label="VACANCY_STATUS_LABEL[v.status]"
          />
        </div>
        <div class="mt-3 flex items-center gap-4 text-xs text-muted">
          <span class="flex items-center gap-1"
            ><UIcon name="i-lucide-users" class="size-3.5" />
            {{ v.applicantCount }} applicant(s)</span
          >
          <span>{{ v.openings }} opening(s)</span>
          <span v-if="v.closingDate">closes {{ v.closingDate }}</span>
        </div>
      </button>
    </div>

    <UModal v-model:open="open" title="Post a vacancy">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title" required><UInput v-model="form.title" autofocus /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Department"><UInput v-model="form.department" /></UFormField>
            <UFormField label="Type"
              ><USelect
                v-model="form.employmentType"
                :items="typeItems"
                value-key="value"
                class="w-full"
            /></UFormField>
            <UFormField label="Location"><UInput v-model="form.location" /></UFormField>
            <UFormField label="Openings"
              ><UInput v-model="form.openings" type="number"
            /></UFormField>
            <UFormField label="Closing date" class="col-span-2"
              ><UInput v-model="form.closingDate" type="date"
            /></UFormField>
          </div>
          <UFormField label="Description"
            ><UTextarea v-model="form.description" :rows="3" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" /><UButton
            label="Post"
            :loading="saving"
            @click="create"
          /></div
      ></template>
    </UModal>
  </div>
</template>
