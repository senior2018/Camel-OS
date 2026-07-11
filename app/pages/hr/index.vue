<script setup lang="ts">
import {
  EMPLOYEE_STATUS_COLOR,
  EMPLOYEE_STATUS_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  type EmployeeStatus,
  type EmploymentType,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'People — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

interface Row {
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
  profileId: string | null
  employeeNumber: string | null
  jobTitle: string | null
  department: string | null
  employmentType: EmploymentType | null
  status: EmployeeStatus | null
  startDate: string | null
}
const { data, status } = await useFetch<{ items: Row[] }>('/api/hr/employees', {
  key: 'hr-employees',
  default: () => ({ items: [] }),
})

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return data.value?.items ?? []
  return (data.value?.items ?? []).filter((r) =>
    [r.firstName, r.lastName, r.email, r.jobTitle, r.department].some((v) =>
      (v ?? '').toLowerCase().includes(q)
    )
  )
})
const name = (r: Row) => [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email
const withFiles = computed(() => (data.value?.items ?? []).filter((r) => r.profileId).length)
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">People</h1>
        <p class="mt-1 text-sm text-muted">
          {{ withFiles }} of {{ data.items.length }} staff have a personnel file.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          to="/hr/leave"
          icon="i-lucide-calendar-check"
          color="neutral"
          variant="outline"
          label="Leave"
        />
        <UButton
          to="/hr/certifications"
          icon="i-lucide-award"
          color="neutral"
          variant="outline"
          label="Certifications"
        />
        <UButton
          to="/hr/recruitment"
          icon="i-lucide-user-search"
          color="neutral"
          variant="outline"
          label="Recruitment"
        />
        <UButton
          to="/hr/reviews"
          icon="i-lucide-clipboard-check"
          color="neutral"
          variant="outline"
          label="Reviews"
        />
        <UButton
          v-if="can('hr', 'admin')"
          to="/hr/payroll"
          icon="i-lucide-banknote"
          color="neutral"
          variant="outline"
          label="Payroll"
        />
        <UButton
          to="/experts"
          icon="i-lucide-graduation-cap"
          color="neutral"
          variant="outline"
          label="Expert Database"
        />
      </div>
    </header>

    <UInput
      v-model="search"
      icon="i-lucide-search"
      placeholder="Search by name, role, department…"
      class="sm:max-w-sm"
    />

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>
    <div v-else class="overflow-hidden rounded-xl border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Name</th>
            <th class="hidden px-4 py-2 font-medium sm:table-cell">Role</th>
            <th class="hidden px-4 py-2 font-medium md:table-cell">Department</th>
            <th class="hidden px-4 py-2 font-medium lg:table-cell">Type</th>
            <th class="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="r in filtered"
            :key="r.userId"
            class="cursor-pointer hover:bg-elevated/40"
            @click="navigateTo(`/hr/${r.userId}`)"
          >
            <td class="px-4 py-2.5">
              <div class="font-medium text-default">{{ name(r) }}</div>
              <div class="text-xs text-muted">{{ r.email }}</div>
            </td>
            <td class="hidden px-4 py-2.5 text-muted sm:table-cell">{{ r.jobTitle ?? '—' }}</td>
            <td class="hidden px-4 py-2.5 text-muted md:table-cell">{{ r.department ?? '—' }}</td>
            <td class="hidden px-4 py-2.5 text-muted lg:table-cell">
              {{ r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] : '—' }}
            </td>
            <td class="px-4 py-2.5">
              <UBadge
                v-if="r.status"
                :color="EMPLOYEE_STATUS_COLOR[r.status]"
                variant="subtle"
                size="xs"
                :label="EMPLOYEE_STATUS_LABEL[r.status]"
              />
              <UBadge v-else color="neutral" variant="soft" size="xs" label="No file" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
