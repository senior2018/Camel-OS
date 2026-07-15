<script setup lang="ts">
import { certificationSchema, type BadgeColor } from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Certifications — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canEdit = computed(() => can.value('hr', 'update'))
const toast = useToast()

type ExpiryState = 'none' | 'valid' | 'expiring' | 'expired'
interface Cert {
  id: string
  userId: string
  firstName: string | null
  lastName: string | null
  name: string
  issuer: string | null
  kind: string
  issuedDate: string | null
  expiryDate: string | null
  credentialId: string | null
  expiryState: ExpiryState
}
const { data, refresh } = await useFetch<{ items: Cert[] }>('/api/hr/certifications', {
  key: 'hr-certs',
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

const filter = ref<'all' | ExpiryState>('all')
const filtered = computed(() =>
  filter.value === 'all'
    ? (data.value?.items ?? [])
    : (data.value?.items ?? []).filter((c) => c.expiryState === filter.value)
)
const expiringCount = computed(
  () => (data.value?.items ?? []).filter((c) => c.expiryState === 'expiring').length
)
const expiredCount = computed(
  () => (data.value?.items ?? []).filter((c) => c.expiryState === 'expired').length
)
const stateColor: Record<ExpiryState, BadgeColor> = {
  none: 'neutral',
  valid: 'success',
  expiring: 'warning',
  expired: 'error',
}
const stateLabel: Record<ExpiryState, string> = {
  none: 'No expiry',
  valid: 'Valid',
  expiring: 'Expiring soon',
  expired: 'Expired',
}
const owner = (c: Cert) => [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Staff'

const open = ref(false)
const form = reactive({
  userId: '',
  name: '',
  issuer: '',
  kind: 'certification',
  issuedDate: '',
  expiryDate: '',
  credentialId: '',
})
async function add() {
  const parsed = certificationSchema.safeParse(form)
  if (!parsed.success) {
    toast.add({ title: 'Pick a staff member and enter a name', color: 'warning' })
    return
  }
  await $fetch('/api/hr/certifications', { method: 'POST', body: parsed.data })
  open.value = false
  Object.assign(form, {
    userId: '',
    name: '',
    issuer: '',
    kind: 'certification',
    issuedDate: '',
    expiryDate: '',
    credentialId: '',
  })
  await refresh()
}
async function del(c: Cert) {
  await $fetch(`/api/hr/certifications/${c.id}`, { method: 'DELETE' })
  await refresh()
}
function fdate(s: string | null) {
  return s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">
          Certifications & Training
        </h1>
        <p class="mt-1 text-sm text-muted">
          <span v-if="expiredCount" class="text-error">{{ expiredCount }} expired</span>
          <span v-if="expiredCount && expiringCount"> · </span>
          <span v-if="expiringCount" class="text-warning"
            >{{ expiringCount }} expiring within 60 days</span
          >
          <span v-if="!expiredCount && !expiringCount">All certifications valid.</span>
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          to="/hr"
          variant="outline"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="People"
        />
        <UButton v-if="canEdit" icon="i-lucide-plus" label="Add" @click="open = true" />
      </div>
    </header>

    <div class="flex flex-wrap gap-1.5">
      <UButton
        v-for="f in ['all', 'expired', 'expiring', 'valid'] as const"
        :key="f"
        size="xs"
        :variant="filter === f ? 'solid' : 'outline'"
        :color="f === 'all' ? 'primary' : stateColor[f as ExpiryState]"
        class="capitalize"
        :label="f === 'all' ? 'All' : stateLabel[f as ExpiryState]"
        @click="filter = f"
      />
    </div>

    <div
      v-if="!filtered.length"
      class="rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-award" class="size-10 text-muted" />
      <p class="mt-2 text-sm text-muted">Nothing to show.</p>
    </div>
    <div v-else class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Staff</th>
            <th class="px-4 py-2 font-medium">Certification</th>
            <th class="hidden px-4 py-2 font-medium sm:table-cell">Issuer</th>
            <th class="px-4 py-2 font-medium">Expiry</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="c in filtered" :key="c.id" class="hover:bg-elevated/40">
            <td class="px-4 py-2.5">
              <NuxtLink :to="`/hr/${c.userId}`" class="text-primary hover:underline">{{
                owner(c)
              }}</NuxtLink>
            </td>
            <td class="px-4 py-2.5 text-default">
              {{ c.name }}
              <UBadge
                size="xs"
                variant="subtle"
                color="neutral"
                class="ml-1 capitalize"
                :label="c.kind"
              />
            </td>
            <td class="hidden px-4 py-2.5 text-muted sm:table-cell">{{ c.issuer ?? '—' }}</td>
            <td class="px-4 py-2.5">
              <UBadge
                :color="stateColor[c.expiryState]"
                variant="subtle"
                size="xs"
                :label="c.expiryDate ? fdate(c.expiryDate) : stateLabel[c.expiryState]"
              />
            </td>
            <td class="px-4 py-2.5 text-right">
              <UButton
                v-if="canEdit"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                aria-label="Remove"
                @click="del(c)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="open" title="Add certification / training">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Staff member" required
            ><USelect
              v-model="form.userId"
              :items="staffItems"
              value-key="value"
              class="w-full"
              placeholder="Select…"
          /></UFormField>
          <UFormField label="Name" required><UInput v-model="form.name" /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Issuer"><UInput v-model="form.issuer" /></UFormField>
            <UFormField label="Kind"
              ><USelect
                v-model="form.kind"
                :items="[
                  { label: 'Certification', value: 'certification' },
                  { label: 'Training', value: 'training' },
                ]"
                value-key="value"
                class="w-full"
            /></UFormField>
            <UFormField label="Issued"><UInput v-model="form.issuedDate" type="date" /></UFormField>
            <UFormField label="Expires"
              ><UInput v-model="form.expiryDate" type="date"
            /></UFormField>
          </div>
          <UFormField label="Credential ID"><UInput v-model="form.credentialId" /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" /><UButton
            label="Add"
            @click="add"
          /></div
      ></template>
    </UModal>
  </div>
</template>
