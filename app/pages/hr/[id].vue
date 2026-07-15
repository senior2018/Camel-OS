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
}>('/api/hr/employees', { key: 'hr-employees-picker', default: () => ({ items: [] }) })
// Nuxt UI v4 forbids an empty-string option value, so "None" uses a sentinel
// that we map back to null on save. (An empty value silently breaks the menu.)
const NONE = '__none__'
const managerItems = computed(() => [
  { label: '— None —', value: NONE },
  ...(staff.value?.items ?? [])
    .filter((s) => s.userId !== id)
    .map((s) => ({
      label: [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email,
      value: s.userId,
    })),
])
const managerName = computed(() => {
  if (!form.managerUserId || form.managerUserId === NONE) return '— None —'
  const m = staff.value?.items.find((s) => s.userId === form.managerUserId)
  return m ? [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email : '—'
})

// ── Editable form (string-typed for inputs; nulls coerced on load) ──
const form = reactive({
  employeeNumber: '',
  jobTitle: '',
  department: '',
  employmentType: 'full_time' as EmploymentType,
  status: 'active' as EmployeeStatus,
  managerUserId: '__none__',
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
  form.managerUserId = p.managerUserId ?? NONE
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
        managerUserId: form.managerUserId === NONE ? null : form.managerUserId || null,
        baseSalary: form.baseSalary === '' ? null : Number(form.baseSalary),
        annualLeaveEntitlement: Number(form.annualLeaveEntitlement),
      },
    })
    toast.add({ title: 'Personnel file saved', color: 'success' })
    editing.value = false
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
  id: null as string | null,
  name: '',
  issuer: '',
  kind: 'certification',
  issuedDate: '',
  expiryDate: '',
  credentialId: '',
})
function openCert(c?: Cert) {
  certForm.id = c?.id ?? null
  certForm.name = c?.name ?? ''
  certForm.issuer = c?.issuer ?? ''
  certForm.kind = c?.kind ?? 'certification'
  certForm.issuedDate = c?.issuedDate ?? ''
  certForm.expiryDate = c?.expiryDate ?? ''
  certForm.credentialId = c?.credentialId ?? ''
  certOpen.value = true
}
async function saveCert() {
  const parsed = certificationSchema.safeParse({
    userId: id,
    name: certForm.name,
    issuer: certForm.issuer || null,
    kind: certForm.kind,
    issuedDate: certForm.issuedDate || null,
    expiryDate: certForm.expiryDate || null,
    credentialId: certForm.credentialId || null,
  })
  if (!parsed.success) {
    toast.add({ title: 'Name is required', color: 'warning' })
    return
  }
  try {
    if (certForm.id) {
      await $fetch(`/api/hr/certifications/${certForm.id}`, { method: 'PATCH', body: parsed.data })
    } else {
      await $fetch('/api/hr/certifications', { method: 'POST', body: parsed.data })
    }
    toast.add({
      title: certForm.id ? 'Certification updated' : 'Certification added',
      color: 'success',
    })
    certOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  }
}
async function delCert(c: Cert) {
  if (!confirm(`Remove "${c.name}"?`)) return
  await $fetch(`/api/hr/certifications/${c.id}`, { method: 'DELETE' })
  await refresh()
}

const tab = ref<'profile' | 'leave' | 'certs'>('profile')
function fdate(s: string | null) {
  return s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
}

// After saving we return to a clean read-only preview; editing opens the form.
// A brand-new file (no profile yet) opens straight into the form to fill in.
const hasProfile = computed(() => !!data.value?.profile)
const editing = ref(false)
watchEffect(() => {
  if (!hasProfile.value && canEdit.value) editing.value = true
})
const money = (v: string | null) =>
  v == null || v === ''
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: form.currency || 'USD',
        maximumFractionDigits: 0,
      }).format(Number(v))
// Read-only preview rows for the personnel file.
const employmentRows = computed(() => [
  { label: 'Employee number', value: form.employeeNumber || '—' },
  { label: 'Job title', value: form.jobTitle || '—' },
  { label: 'Department', value: form.department || '—' },
  { label: 'Employment type', value: EMPLOYMENT_TYPE_LABEL[form.employmentType] },
  { label: 'Status', value: EMPLOYEE_STATUS_LABEL[form.status] },
  { label: 'Line manager', value: managerName.value },
  { label: 'Start date', value: fdate(form.startDate || null) },
  { label: 'End date', value: fdate(form.endDate || null) },
  { label: 'Annual leave (days)', value: form.annualLeaveEntitlement || '—' },
  { label: `Base salary (${form.currency})`, value: money(form.baseSalary) },
])
const personalRows = computed(() => [
  { label: 'Date of birth', value: fdate(form.dateOfBirth || null) },
  { label: 'National ID', value: form.nationalId || '—' },
  { label: 'Phone', value: form.phone || '—' },
  { label: 'Address', value: form.address || '—' },
  { label: 'Emergency contact name', value: form.emergencyContactName || '—' },
  { label: 'Emergency contact phone', value: form.emergencyContactPhone || '—' },
])
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

      <!-- Read-only preview (default once a file exists) -->
      <template v-if="hasProfile && !editing">
        <div class="flex justify-end">
          <UButton
            v-if="canEdit"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            label="Edit"
            @click="editing = true"
          />
        </div>
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Employment</h3></template
          >
          <dl class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <div v-for="row in employmentRows" :key="row.label" class="flex flex-col">
              <dt class="text-xs uppercase tracking-wide text-muted">{{ row.label }}</dt>
              <dd class="mt-0.5 text-sm font-medium text-default">{{ row.value }}</dd>
            </div>
          </dl>
        </UCard>
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Personal &amp; emergency</h3></template
          >
          <dl class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <div v-for="row in personalRows" :key="row.label" class="flex flex-col">
              <dt class="text-xs uppercase tracking-wide text-muted">{{ row.label }}</dt>
              <dd class="mt-0.5 text-sm font-medium text-default">{{ row.value }}</dd>
            </div>
          </dl>
        </UCard>
      </template>

      <!-- Editable form -->
      <template v-else>
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Employment</h3></template
          >
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Employee number"
              ><UInput v-model="form.employeeNumber" class="w-full"
            /></UFormField>
            <UFormField label="Job title"
              ><UInput v-model="form.jobTitle" class="w-full"
            /></UFormField>
            <UFormField label="Department"
              ><UInput v-model="form.department" class="w-full"
            /></UFormField>
            <UFormField label="Employment type"
              ><USelect
                v-model="form.employmentType"
                :items="typeItems"
                value-key="value"
                class="w-full"
            /></UFormField>
            <UFormField label="Status"
              ><USelect v-model="form.status" :items="statusItems" value-key="value" class="w-full"
            /></UFormField>
            <UFormField label="Line manager"
              ><USelect
                v-model="form.managerUserId"
                :items="managerItems"
                value-key="value"
                class="w-full"
            /></UFormField>
            <UFormField label="Start date"
              ><UInput v-model="form.startDate" type="date" class="w-full"
            /></UFormField>
            <UFormField label="End date"
              ><UInput v-model="form.endDate" type="date" class="w-full"
            /></UFormField>
            <UFormField label="Annual leave (days)"
              ><UInput v-model="form.annualLeaveEntitlement" type="number" class="w-full"
            /></UFormField>
            <UFormField :label="`Base salary (${form.currency})`"
              ><UInput v-model="form.baseSalary" type="number" class="w-full" placeholder="0"
            /></UFormField>
          </div>
        </UCard>
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Personal &amp; emergency</h3></template
          >
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Date of birth"
              ><UInput v-model="form.dateOfBirth" type="date" class="w-full"
            /></UFormField>
            <UFormField label="National ID"
              ><UInput v-model="form.nationalId" class="w-full"
            /></UFormField>
            <UFormField label="Phone"><UInput v-model="form.phone" class="w-full" /></UFormField>
            <UFormField label="Address"
              ><UInput v-model="form.address" class="w-full"
            /></UFormField>
            <UFormField label="Emergency contact name"
              ><UInput v-model="form.emergencyContactName" class="w-full"
            /></UFormField>
            <UFormField label="Emergency contact phone"
              ><UInput v-model="form.emergencyContactPhone" class="w-full"
            /></UFormField>
          </div>
        </UCard>
        <div v-if="canEdit" class="flex justify-end gap-2">
          <UButton
            v-if="hasProfile"
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="editing = false"
          />
          <UButton label="Save personnel file" :loading="saving" @click="save" />
        </div>
      </template>
    </div>

    <!-- Leave history -->
    <div v-show="tab === 'leave'">
      <p
        v-if="!data.leave.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No leave on record.
      </p>
      <div v-else class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
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
          @click="openCert()"
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
        class="flex items-start justify-between gap-3 rounded-lg border border-default bg-default p-3 shadow-sm"
      >
        <div class="min-w-0">
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
            {{ c.issuer ?? '—' }}
            <span v-if="c.issuedDate"> · issued {{ fdate(c.issuedDate) }}</span>
            <span v-if="c.expiryDate"> · expires {{ fdate(c.expiryDate) }}</span>
            <span v-if="c.credentialId"> · ID {{ c.credentialId }}</span>
          </p>
        </div>
        <div v-if="canEdit" class="flex shrink-0 items-center gap-1">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-pencil"
            aria-label="Edit"
            @click="openCert(c)"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            aria-label="Remove"
            @click="delCert(c)"
          />
        </div>
      </div>
    </div>

    <UModal
      v-model:open="certOpen"
      :title="certForm.id ? 'Edit certification' : 'Add certification / training'"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required
            ><UInput v-model="certForm.name" autofocus class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Issuer"
              ><UInput v-model="certForm.issuer" class="w-full"
            /></UFormField>
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
              ><UInput v-model="certForm.issuedDate" type="date" class="w-full"
            /></UFormField>
            <UFormField label="Expires"
              ><UInput v-model="certForm.expiryDate" type="date" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Credential ID"
            ><UInput v-model="certForm.credentialId" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="certOpen = false"
          /><UButton :label="certForm.id ? 'Save' : 'Add'" @click="saveCert" /></div
      ></template>
    </UModal>
  </div>
</template>
