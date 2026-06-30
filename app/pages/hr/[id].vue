<script setup lang="ts">
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABEL,
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_LABEL,
  LEAVE_STATUS_COLOR,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  certificationSchema,
  type EmployeeStatus,
  type EmploymentType,
  type LeaveStatus,
  type LeaveType,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const canEdit = computed(() => can.value('hr', 'update'))
const toast = useToast()

interface Profile {
  employeeNumber: string | null
  jobTitle: string | null
  department: string | null
  employmentType: EmploymentType
  status: EmployeeStatus
  managerUserId: string | null
  startDate: string | null
  endDate: string | null
  dateOfBirth: string | null
  nationalId: string | null
  phone: string | null
  address: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  annualLeaveEntitlement: string
  baseSalary: string | null
  currency: string
  notes: string | null
}
interface Leave {
  id: string
  type: LeaveType
  startDate: string
  endDate: string
  days: string
  status: LeaveStatus
}
interface Cert {
  id: string
  name: string
  issuer: string | null
  kind: string
  issuedDate: string | null
  expiryDate: string | null
  credentialId: string | null
}
interface Payload {
  user: { id: string; firstName: string | null; lastName: string | null; email: string }
  profile: Profile | null
  leave: Leave[]
  certifications: Cert[]
}
const { data, refresh } = await useFetch<Payload>(`/api/hr/employees/${id}`, {
  key: `hr-emp-${id}`,
})
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const fullName = computed(
  () =>
    [data.value?.user.firstName, data.value?.user.lastName].filter(Boolean).join(' ') ||
    data.value?.user.email
)
useHead(() => ({ title: `${fullName.value} — Camel OS` }))

const { data: staff } = useFetch<{
  items: { userId: string; firstName: string | null; lastName: string | null; email: string }[]
}>('/api/hr/employees', { key: 'hr-employees', default: () => ({ items: [] }) })
const managerItems = computed(() => [
  { label: '— None —', value: '' },
  ...(staff.value?.items ?? [])
    .filter((s) => s.userId !== id)
    .map((s) => ({
      label: [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email,
      value: s.userId,
    })),
])

// ── Editable form (string-typed for inputs; nulls coerced on load) ──
const form = reactive({
  employeeNumber: '',
  jobTitle: '',
  department: '',
  employmentType: 'full_time' as EmploymentType,
  status: 'active' as EmployeeStatus,
  managerUserId: '',
  startDate: '',
  endDate: '',
  dateOfBirth: '',
  nationalId: '',
  phone: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  annualLeaveEntitlement: '21',
  baseSalary: '',
  currency: 'USD',
  notes: '',
})
watchEffect(() => {
  const p = data.value?.profile
  if (!p) return
  form.employeeNumber = p.employeeNumber ?? ''
  form.jobTitle = p.jobTitle ?? ''
  form.department = p.department ?? ''
  form.employmentType = p.employmentType
  form.status = p.status
  form.managerUserId = p.managerUserId ?? ''
  form.startDate = p.startDate ?? ''
  form.endDate = p.endDate ?? ''
  form.dateOfBirth = p.dateOfBirth ?? ''
  form.nationalId = p.nationalId ?? ''
  form.phone = p.phone ?? ''
  form.address = p.address ?? ''
  form.emergencyContactName = p.emergencyContactName ?? ''
  form.emergencyContactPhone = p.emergencyContactPhone ?? ''
  form.annualLeaveEntitlement = p.annualLeaveEntitlement ?? '21'
  form.baseSalary = p.baseSalary ?? ''
  form.currency = p.currency ?? 'USD'
  form.notes = p.notes ?? ''
})
const typeItems = EMPLOYMENT_TYPES.map((t) => ({
  label: EMPLOYMENT_TYPE_LABEL[t],
  value: t as string,
}))
const statusItems = EMPLOYEE_STATUSES.map((s) => ({
  label: EMPLOYEE_STATUS_LABEL[s],
  value: s as string,
}))

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch(`/api/hr/employees/${id}`, {
      method: 'PUT',
      body: {
        ...form,
        managerUserId: form.managerUserId || null,
        baseSalary: form.baseSalary === '' ? null : Number(form.baseSalary),
        annualLeaveEntitlement: Number(form.annualLeaveEntitlement),
      },
    })
    toast.add({ title: 'Personnel file saved', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── Certifications ──
const certOpen = ref(false)
const certForm = reactive({
  name: '',
  issuer: '',
  kind: 'certification',
  issuedDate: '',
  expiryDate: '',
  credentialId: '',
})
async function addCert() {
  const parsed = certificationSchema.safeParse({ ...certForm, userId: id })
  if (!parsed.success) {
    toast.add({ title: 'Name is required', color: 'warning' })
    return
  }
  await $fetch('/api/hr/certifications', { method: 'POST', body: parsed.data })
  certOpen.value = false
  Object.assign(certForm, {
    name: '',
    issuer: '',
    kind: 'certification',
    issuedDate: '',
    expiryDate: '',
    credentialId: '',
  })
  await refresh()
}
async function delCert(c: Cert) {
  await $fetch(`/api/hr/certifications/${c.id}`, { method: 'DELETE' })
  await refresh()
}

const tab = ref<'profile' | 'leave' | 'certs'>('profile')
function fdate(s: string | null) {
  return s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
}
</script>

<template>
  <div v-if="data" class="space-y-5">
    <div>
      <UButton
        variant="link"
        color="neutral"
        icon="i-lucide-arrow-left"
        label="All people"
        class="-ml-2"
        @click="navigateTo('/hr')"
      />
      <h1 class="mt-1 text-2xl font-semibold tracking-tight text-default">{{ fullName }}</h1>
      <p class="text-sm text-muted">{{ data.user.email }}</p>
    </div>

    <div class="flex gap-1 border-b border-default">
      <button
        v-for="t in ['profile', 'leave', 'certs'] as const"
        :key="t"
        class="border-b-2 px-3 py-2 text-sm font-medium capitalize"
        :class="tab === t ? 'border-primary text-primary' : 'border-transparent text-muted'"
        @click="tab = t"
      >
        {{ t === 'certs' ? 'Certifications' : t === 'leave' ? 'Leave history' : 'Profile' }}
      </button>
    </div>

    <!-- Profile -->
    <div v-show="tab === 'profile'" class="space-y-4">
      <div
        v-if="!canEdit && !data.profile"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No personnel file yet.
      </div>
      <UCard>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Employee number"
            ><UInput v-model="form.employeeNumber" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Job title"
            ><UInput v-model="form.jobTitle" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Department"
            ><UInput v-model="form.department" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Employment type"
            ><USelect
              v-model="form.employmentType"
              :items="typeItems"
              value-key="value"
              :disabled="!canEdit"
              class="w-full"
          /></UFormField>
          <UFormField label="Status"
            ><USelect
              v-model="form.status"
              :items="statusItems"
              value-key="value"
              :disabled="!canEdit"
              class="w-full"
          /></UFormField>
          <UFormField label="Line manager"
            ><USelect
              v-model="form.managerUserId"
              :items="managerItems"
              value-key="value"
              :disabled="!canEdit"
              class="w-full"
          /></UFormField>
          <UFormField label="Start date"
            ><UInput v-model="form.startDate" type="date" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="End date"
            ><UInput v-model="form.endDate" type="date" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Annual leave (days)"
            ><UInput v-model="form.annualLeaveEntitlement" type="number" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Base salary"
            ><UInput
              v-model="form.baseSalary"
              type="number"
              :disabled="!canEdit"
              :placeholder="form.currency"
          /></UFormField>
        </div>
      </UCard>
      <UCard>
        <template #header
          ><h3 class="text-sm font-semibold text-default">Personal & emergency</h3></template
        >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Date of birth"
            ><UInput v-model="form.dateOfBirth" type="date" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="National ID"
            ><UInput v-model="form.nationalId" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Phone"
            ><UInput v-model="form.phone" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Address"
            ><UInput v-model="form.address" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Emergency contact"
            ><UInput v-model="form.emergencyContactName" :disabled="!canEdit"
          /></UFormField>
          <UFormField label="Emergency phone"
            ><UInput v-model="form.emergencyContactPhone" :disabled="!canEdit"
          /></UFormField>
        </div>
      </UCard>
      <div v-if="canEdit" class="flex justify-end">
        <UButton label="Save personnel file" :loading="saving" @click="save" />
      </div>
    </div>

    <!-- Leave history -->
    <div v-show="tab === 'leave'">
      <p
        v-if="!data.leave.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No leave on record.
      </p>
      <div v-else class="overflow-hidden rounded-xl border border-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Type</th>
              <th class="px-4 py-2 font-medium">Dates</th>
              <th class="px-4 py-2 font-medium">Days</th>
              <th class="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="l in data.leave" :key="l.id">
              <td class="px-4 py-2.5 text-default">{{ LEAVE_TYPE_LABEL[l.type] }}</td>
              <td class="px-4 py-2.5 text-muted">
                {{ fdate(l.startDate) }} → {{ fdate(l.endDate) }}
              </td>
              <td class="px-4 py-2.5 text-muted">{{ Number(l.days) }}</td>
              <td class="px-4 py-2.5">
                <UBadge
                  :color="LEAVE_STATUS_COLOR[l.status]"
                  variant="subtle"
                  size="xs"
                  :label="LEAVE_STATUS_LABEL[l.status]"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Certifications -->
    <div v-show="tab === 'certs'" class="space-y-3">
      <div class="flex justify-end">
        <UButton
          v-if="canEdit"
          size="sm"
          icon="i-lucide-plus"
          label="Add certification"
          @click="certOpen = true"
        />
      </div>
      <p
        v-if="!data.certifications.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No certifications recorded.
      </p>
      <div
        v-for="c in data.certifications"
        :key="c.id"
        class="flex items-center justify-between rounded-lg border border-default bg-default p-3"
      >
        <div>
          <p class="font-medium text-default">
            {{ c.name }}
            <UBadge
              size="xs"
              variant="subtle"
              color="neutral"
              :label="c.kind"
              class="ml-1 capitalize"
            />
          </p>
          <p class="text-xs text-muted">
            {{ c.issuer ?? '—'
            }}<span v-if="c.expiryDate"> · expires {{ fdate(c.expiryDate) }}</span>
          </p>
        </div>
        <UButton
          v-if="canEdit"
          size="xs"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          aria-label="Remove"
          @click="delCert(c)"
        />
      </div>
    </div>

    <UModal v-model:open="certOpen" title="Add certification / training">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required
            ><UInput v-model="certForm.name" autofocus
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Issuer"><UInput v-model="certForm.issuer" /></UFormField>
            <UFormField label="Kind"
              ><USelect
                v-model="certForm.kind"
                :items="[
                  { label: 'Certification', value: 'certification' },
                  { label: 'Training', value: 'training' },
                ]"
                value-key="value"
                class="w-full"
            /></UFormField>
            <UFormField label="Issued"
              ><UInput v-model="certForm.issuedDate" type="date"
            /></UFormField>
            <UFormField label="Expires"
              ><UInput v-model="certForm.expiryDate" type="date"
            /></UFormField>
          </div>
          <UFormField label="Credential ID"><UInput v-model="certForm.credentialId" /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="certOpen = false"
          /><UButton label="Add" @click="addCert" /></div
      ></template>
    </UModal>
  </div>
</template>
