<script setup lang="ts">
import {
  CONTRACT_STATUS_COLOR,
  PO_STATUS_COLOR,
  PO_STATUS_LABEL,
  RFQ_STATUS_COLOR,
  type ContractStatus,
  type PoStatus,
  type RfqStatus,
} from '@@/shared/schemas/procurement'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Procurement — Camel OS' })

const { can } = await usePermissions()
if (!can.value('procurement', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access to Procurement', fatal: true })
}
const canManage = computed(
  () => can.value('procurement', 'create') || can.value('procurement', 'update')
)
const toast = useToast()
const NONE = '__none__'

const tab = ref<'dashboard' | 'pos' | 'vendors' | 'rfqs' | 'contracts'>('dashboard')
const tabs = [
  { key: 'dashboard', label: 'Dashboard', icon: 'i-lucide-gauge' },
  { key: 'pos', label: 'Purchase Orders', icon: 'i-lucide-clipboard-list' },
  { key: 'vendors', label: 'Vendors', icon: 'i-lucide-store' },
  { key: 'rfqs', label: 'RFQs', icon: 'i-lucide-mail' },
  { key: 'contracts', label: 'Contracts', icon: 'i-lucide-file-signature' },
] as const

const busy = ref(false)
async function call(fn: () => Promise<unknown>, ok?: string) {
  if (busy.value) return false
  busy.value = true
  try {
    await fn()
    toast.add({ title: ok ?? 'Saved', color: 'success' })
    return true
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Action failed', description: msg, color: 'error' })
    return false
  } finally {
    busy.value = false
  }
}
const money = (v: number | string | null, cur = 'USD') =>
  v == null
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: 0,
      }).format(Number(v))
const fdate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

// Pickers
const { data: vendorData, refresh: refreshVendors } = await useFetch<{
  items: {
    id: string
    name: string
    category: string | null
    contactName: string | null
    contactEmail: string | null
    status: string
    complianceDocUrl: string | null
  }[]
}>('/api/procurement/vendors', { key: 'proc-vendors', default: () => ({ items: [] }) })
const vendorItems = computed(() => [
  { label: 'No vendor', value: NONE },
  ...(vendorData.value?.items ?? []).map((v) => ({ label: v.name, value: v.id })),
])
const { data: projData } = await useFetch<{ items: { id: string; name: string }[] }>(
  '/api/projects',
  { key: 'proc-projects', query: { all: '1' }, default: () => ({ items: [] }) }
)
const projectItems = computed(() => [
  { label: 'No project', value: NONE },
  ...(projData.value?.items ?? []).map((p) => ({ label: p.name, value: p.id })),
])
// Configured budget categories — a PO's category must match a project budget
// line for its spend to roll up as "committed" on that project's budget.
const { data: projSettings } = await useFetch<{ settings: { budgetCategories: string[] } }>(
  '/api/projects/settings',
  { key: 'proc-proj-settings', default: () => ({ settings: { budgetCategories: [] } }) }
)
const budgetCategoryItems = computed(() => projSettings.value?.settings.budgetCategories ?? [])

// Dashboard
const { data: dashData } = await useFetch<{
  byStatus: { status: PoStatus; count: number; value: number }[]
  committedValue: number
  activeContracts: number
}>('/api/procurement/dashboard', {
  key: 'proc-dash',
  default: () => ({ byStatus: [], committedValue: 0, activeContracts: 0 }),
})

// POs
interface PO {
  id: string
  poNumber: string
  title: string
  amount: string
  currency: string
  status: PoStatus
  vendorName: string | null
  projectName: string | null
  budgetCategory: string | null
  expectedDate: string | null
  lines: { description: string; quantity: string; unitPrice: string; amount: string }[]
  receipts: { receivedDate: string; complete: boolean }[]
}
const { data: poData, refresh: refreshPos } = await useFetch<{ items: PO[] }>(
  '/api/procurement/purchase-orders',
  { key: 'proc-pos', default: () => ({ items: [] }) }
)
const poOpen = ref(false)
const poForm = reactive({
  poNumber: '',
  title: '',
  vendorId: NONE,
  projectId: NONE,
  budgetCategory: '',
  currency: 'USD',
  orderedDate: new Date().toISOString().slice(0, 10),
  expectedDate: '',
  lines: [{ description: '', quantity: 1, unitPrice: 0 }],
})
const poTotal = computed(() =>
  poForm.lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0)
)
async function createPo() {
  if (!poForm.poNumber.trim() || !poForm.title.trim()) return
  if (
    await call(
      () =>
        $fetch('/api/procurement/purchase-orders', {
          method: 'POST',
          body: {
            poNumber: poForm.poNumber,
            title: poForm.title,
            vendorId: poForm.vendorId === NONE ? null : poForm.vendorId,
            projectId: poForm.projectId === NONE ? null : poForm.projectId,
            budgetCategory: poForm.budgetCategory || null,
            currency: poForm.currency || 'USD',
            orderedDate: poForm.orderedDate || null,
            expectedDate: poForm.expectedDate || null,
            lines: poForm.lines.filter((l) => l.description.trim()),
          },
        }),
      'Purchase order raised'
    )
  ) {
    poOpen.value = false
    Object.assign(poForm, {
      poNumber: '',
      title: '',
      budgetCategory: '',
      expectedDate: '',
      lines: [{ description: '', quantity: 1, unitPrice: 0 }],
    })
    await refreshPos()
  }
}
async function setPoStatus(po: PO, status: PoStatus) {
  await call(
    () =>
      $fetch(`/api/procurement/purchase-orders/${po.id}`, { method: 'PATCH', body: { status } }),
    'PO updated'
  )
  await refreshPos()
}
async function delPo(po: PO) {
  if (!confirm(`Delete PO ${po.poNumber}?`)) return
  if (
    await call(
      () => $fetch(`/api/procurement/purchase-orders/${po.id}`, { method: 'DELETE' }),
      'PO deleted'
    )
  )
    await refreshPos()
}
const receiptOpen = ref(false)
const receiptPo = ref<PO | null>(null)
const receiptForm = reactive({
  receivedDate: new Date().toISOString().slice(0, 10),
  complete: true,
  note: '',
})
function openReceipt(po: PO) {
  receiptPo.value = po
  Object.assign(receiptForm, {
    receivedDate: new Date().toISOString().slice(0, 10),
    complete: true,
    note: '',
  })
  receiptOpen.value = true
}
async function saveReceipt() {
  if (!receiptPo.value) return
  if (
    await call(
      () =>
        $fetch(`/api/procurement/purchase-orders/${receiptPo.value!.id}/receipts`, {
          method: 'POST',
          body: { ...receiptForm },
        }),
      'Delivery recorded'
    )
  ) {
    receiptOpen.value = false
    await refreshPos()
  }
}

// Vendors
type Vendor = {
  id: string
  name: string
  category: string | null
  contactName: string | null
  contactEmail: string | null
  status: string
  complianceDocUrl: string | null
}
const venOpen = ref(false)
const venForm = reactive({
  id: null as string | null,
  name: '',
  category: '',
  contactName: '',
  contactEmail: '',
  phone: '',
  taxId: '',
  complianceDocUrl: '',
  notes: '',
})
function openVendor(v?: Vendor) {
  venForm.id = v?.id ?? null
  venForm.name = v?.name ?? ''
  venForm.category = v?.category ?? ''
  venForm.contactName = v?.contactName ?? ''
  venForm.contactEmail = v?.contactEmail ?? ''
  venForm.phone = ''
  venForm.taxId = ''
  venForm.complianceDocUrl = v?.complianceDocUrl ?? ''
  venForm.notes = ''
  venOpen.value = true
}
async function saveVendor() {
  if (!venForm.name.trim()) return
  const body = {
    name: venForm.name,
    category: venForm.category || null,
    contactName: venForm.contactName || null,
    contactEmail: venForm.contactEmail || null,
    phone: venForm.phone || null,
    taxId: venForm.taxId || null,
    complianceDocUrl: venForm.complianceDocUrl || null,
    notes: venForm.notes || null,
  }
  const ok = await call(
    () =>
      venForm.id
        ? $fetch(`/api/procurement/vendors/${venForm.id}`, { method: 'PATCH', body })
        : $fetch('/api/procurement/vendors', { method: 'POST', body }),
    venForm.id ? 'Vendor updated' : 'Vendor added'
  )
  if (ok) {
    venOpen.value = false
    await refreshVendors()
  }
}
async function delVendor(v: Vendor) {
  if (!confirm(`Delete vendor "${v.name}"?`)) return
  if (
    await call(
      () => $fetch(`/api/procurement/vendors/${v.id}`, { method: 'DELETE' }),
      'Vendor deleted'
    )
  )
    await refreshVendors()
}
// Vendor pagination (register can grow large).
const venPage = ref(1)
const venPageSize = 8
const pagedVendors = computed(() =>
  (vendorData.value?.items ?? []).slice(
    (venPage.value - 1) * venPageSize,
    venPage.value * venPageSize
  )
)
watch(
  () => vendorData.value?.items,
  () => (venPage.value = 1)
)

// RFQs
interface Rfq {
  id: string
  title: string
  dueDate: string | null
  status: RfqStatus
  invitedVendors: string[]
  responses: { vendor: string; amount: number; note?: string }[]
  awardedVendor: string | null
}
const { data: rfqData, refresh: refreshRfqs } = await useFetch<{ items: Rfq[] }>(
  '/api/procurement/rfqs',
  { key: 'proc-rfqs', default: () => ({ items: [] }) }
)
const rfqOpen = ref(false)
const rfqForm = reactive({
  id: null as string | null,
  title: '',
  description: '',
  dueDate: '',
  invited: '',
})
function openRfq(r?: Rfq) {
  rfqForm.id = r?.id ?? null
  rfqForm.title = r?.title ?? ''
  rfqForm.description = ''
  rfqForm.dueDate = r?.dueDate ?? ''
  rfqForm.invited = r?.invitedVendors.join(', ') ?? ''
  rfqOpen.value = true
}
async function saveRfq() {
  if (!rfqForm.title.trim()) return
  const body = {
    title: rfqForm.title,
    description: rfqForm.description || null,
    dueDate: rfqForm.dueDate || null,
    invitedVendors: rfqForm.invited
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
  const ok = await call(
    () =>
      rfqForm.id
        ? $fetch(`/api/procurement/rfqs/${rfqForm.id}`, { method: 'PATCH', body })
        : $fetch('/api/procurement/rfqs', { method: 'POST', body }),
    rfqForm.id ? 'RFQ updated' : 'RFQ issued'
  )
  if (ok) {
    rfqOpen.value = false
    await refreshRfqs()
  }
}
async function delRfq(r: Rfq) {
  if (!confirm(`Delete RFQ "${r.title}"?`)) return
  if (
    await call(() => $fetch(`/api/procurement/rfqs/${r.id}`, { method: 'DELETE' }), 'RFQ deleted')
  )
    await refreshRfqs()
}
async function awardRfq(r: Rfq, vendor: string) {
  await call(
    () =>
      $fetch(`/api/procurement/rfqs/${r.id}`, {
        method: 'PATCH',
        body: { status: 'awarded', awardedVendor: vendor },
      }),
    'RFQ awarded'
  )
  await refreshRfqs()
}

// Contracts
interface Contract {
  id: string
  title: string
  vendorName: string | null
  value: string | null
  currency: string
  startDate: string | null
  endDate: string | null
  status: ContractStatus
}
const { data: conData, refresh: refreshCon } = await useFetch<{ items: Contract[] }>(
  '/api/procurement/contracts',
  { key: 'proc-contracts', default: () => ({ items: [] }) }
)
const conOpen = ref(false)
const conForm = reactive({
  id: null as string | null,
  title: '',
  vendorId: NONE,
  vendorName: '',
  value: null as number | null,
  currency: 'USD',
  startDate: '',
  endDate: '',
  documentUrl: '',
})
function openContract(c?: Contract) {
  conForm.id = c?.id ?? null
  conForm.title = c?.title ?? ''
  conForm.vendorId = vendorData.value?.items.find((v) => v.name === c?.vendorName)?.id ?? NONE
  conForm.vendorName = c?.vendorName ?? ''
  conForm.value = c?.value != null ? Number(c.value) : null
  conForm.currency = c?.currency ?? 'USD'
  conForm.startDate = c?.startDate ?? ''
  conForm.endDate = c?.endDate ?? ''
  conForm.documentUrl = ''
  conOpen.value = true
}
async function saveContract() {
  if (!conForm.title.trim()) return
  const vName =
    conForm.vendorId === NONE
      ? conForm.vendorName
      : vendorData.value?.items.find((v) => v.id === conForm.vendorId)?.name
  const body = {
    title: conForm.title,
    vendorId: conForm.vendorId === NONE ? null : conForm.vendorId,
    vendorName: vName || null,
    value: conForm.value,
    currency: conForm.currency || 'USD',
    startDate: conForm.startDate || null,
    endDate: conForm.endDate || null,
    documentUrl: conForm.documentUrl || null,
  }
  const ok = await call(
    () =>
      conForm.id
        ? $fetch(`/api/procurement/contracts/${conForm.id}`, { method: 'PATCH', body })
        : $fetch('/api/procurement/contracts', { method: 'POST', body }),
    conForm.id ? 'Contract updated' : 'Contract added'
  )
  if (ok) {
    conOpen.value = false
    await refreshCon()
  }
}
async function delContract(c: Contract) {
  if (!confirm(`Delete contract "${c.title}"?`)) return
  if (
    await call(
      () => $fetch(`/api/procurement/contracts/${c.id}`, { method: 'DELETE' }),
      'Contract deleted'
    )
  )
    await refreshCon()
}
async function setContractStatus(c: Contract, status: ContractStatus) {
  await call(
    () => $fetch(`/api/procurement/contracts/${c.id}`, { method: 'PATCH', body: { status } }),
    'Contract updated'
  )
  await refreshCon()
}

// ── Dashboard analytics (client-computed from the loaded data) ──
const PO_LIVE = new Set(['approved', 'committed', 'received', 'closed'])
const spendByCategory = computed(() => {
  const m: Record<string, number> = {}
  for (const p of poData.value?.items ?? [])
    if (PO_LIVE.has(p.status))
      m[p.budgetCategory || 'Uncategorised'] =
        (m[p.budgetCategory || 'Uncategorised'] ?? 0) + Number(p.amount)
  return Object.entries(m)
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value)
})
const maxCatSpend = computed(() => Math.max(1, ...spendByCategory.value.map((c) => c.value)))
const recentPos = computed(() => (poData.value?.items ?? []).slice(0, 6))
const expiringContracts = computed(() => {
  const soon = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
  return (conData.value?.items ?? [])
    .filter((c) => c.status === 'active' && c.endDate && c.endDate <= soon)
    .sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? ''))
})
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Procurement</h1>
        <p class="mt-1 text-sm text-muted">
          Purchase orders, vendor register, RFQs, deliveries, and contracts.
        </p>
      </div>
    </header>

    <div class="flex gap-1 overflow-x-auto border-b border-default">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="
          tab === t.key
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-default'
        "
        @click="tab = t.key"
      >
        <UIcon :name="t.icon" class="size-4" /> {{ t.label }}
      </button>
    </div>

    <!-- DASHBOARD (PR-07) -->
    <div v-show="tab === 'dashboard'" class="space-y-4">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Committed value (PR-05)</p>
          <p class="mt-1 text-xl font-semibold text-default">
            {{ money(dashData?.committedValue) }}
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Active contracts</p>
          <p class="mt-1 text-xl font-semibold text-default">{{ dashData?.activeContracts }}</p>
        </div>
        <div
          v-for="s in dashData?.byStatus ?? []"
          :key="s.status"
          class="rounded-xl border border-default bg-default p-4 shadow-sm"
        >
          <p class="text-xs uppercase tracking-wide text-muted">
            {{ PO_STATUS_LABEL[s.status] }} POs
          </p>
          <p class="mt-1 text-xl font-semibold text-default">{{ s.count }}</p>
          <p class="text-xs text-muted">{{ money(s.value) }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- Spend by budget category (PR-05 commitment accounting) -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold text-default">Committed spend by category</h3>
          </template>
          <div v-if="spendByCategory.length" class="space-y-2.5">
            <div v-for="c in spendByCategory" :key="c.category" class="text-sm">
              <div class="flex justify-between">
                <span class="text-default">{{ c.category }}</span>
                <span class="font-medium text-default">{{ money(c.value) }}</span>
              </div>
              <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div
                  class="h-full rounded-full bg-primary"
                  :style="{ width: `${(c.value / maxCatSpend) * 100}%` }"
                />
              </div>
            </div>
          </div>
          <p v-else class="py-6 text-center text-sm text-muted">No committed POs yet.</p>
        </UCard>

        <!-- Contracts expiring within 90 days -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold text-default">Contracts expiring soon</h3>
          </template>
          <ul v-if="expiringContracts.length" class="divide-y divide-default">
            <li
              v-for="c in expiringContracts"
              :key="c.id"
              class="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div class="min-w-0">
                <p class="truncate text-default">{{ c.title }}</p>
                <p class="text-xs text-muted">{{ c.vendorName || '—' }}</p>
              </div>
              <span class="shrink-0 text-xs text-warning">expires {{ fdate(c.endDate) }}</span>
            </li>
          </ul>
          <p v-else class="py-6 text-center text-sm text-muted">
            No contracts expiring in the next 90 days.
          </p>
        </UCard>

        <!-- Recent purchase orders -->
        <UCard class="lg:col-span-2">
          <template #header>
            <h3 class="text-sm font-semibold text-default">Recent purchase orders</h3>
          </template>
          <ul v-if="recentPos.length" class="divide-y divide-default">
            <li
              v-for="p in recentPos"
              :key="p.id"
              class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <div class="min-w-0">
                <p class="truncate font-medium text-default">{{ p.poNumber }} · {{ p.title }}</p>
                <p class="text-xs text-muted">
                  {{ p.vendorName || 'No vendor' }}
                  <span v-if="p.projectName"> · {{ p.projectName }}</span>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-default">{{ money(p.amount, p.currency) }}</span>
                <UBadge
                  :color="PO_STATUS_COLOR[p.status]"
                  variant="subtle"
                  size="xs"
                  :label="PO_STATUS_LABEL[p.status]"
                />
              </div>
            </li>
          </ul>
          <p v-else class="py-6 text-center text-sm text-muted">No purchase orders yet.</p>
        </UCard>
      </div>
    </div>

    <!-- PURCHASE ORDERS -->
    <div v-show="tab === 'pos'" class="space-y-3">
      <div v-if="canManage" class="flex justify-end">
        <UButton size="sm" icon="i-lucide-plus" label="Raise PO" @click="poOpen = true" />
      </div>
      <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">PO / Vendor</th>
              <th class="hidden px-4 py-2 font-medium md:table-cell">Project</th>
              <th class="px-4 py-2 text-right font-medium">Amount</th>
              <th class="px-4 py-2 font-medium">Status</th>
              <th v-if="canManage" class="px-4 py-2 text-right font-medium">Lifecycle</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="po in poData?.items ?? []" :key="po.id">
              <td class="px-4 py-2.5">
                <p class="font-medium text-default">{{ po.poNumber }} · {{ po.title }}</p>
                <p class="text-xs text-muted">
                  {{ po.vendorName || 'No vendor'
                  }}<span v-if="po.receipts.length"> · delivered</span>
                </p>
              </td>
              <td class="hidden px-4 py-2.5 text-muted md:table-cell">
                {{ po.projectName || '—' }}
              </td>
              <td class="px-4 py-2.5 text-right text-default">
                {{ money(po.amount, po.currency) }}
              </td>
              <td class="px-4 py-2.5">
                <UBadge
                  :color="PO_STATUS_COLOR[po.status]"
                  variant="subtle"
                  size="xs"
                  :label="PO_STATUS_LABEL[po.status]"
                />
              </td>
              <td v-if="canManage" class="px-4 py-2.5 text-right">
                <div class="flex justify-end gap-1">
                  <UButton
                    v-if="po.status === 'draft'"
                    size="xs"
                    variant="soft"
                    label="Approve"
                    @click="setPoStatus(po, 'approved')"
                  />
                  <UButton
                    v-if="po.status === 'approved'"
                    size="xs"
                    color="warning"
                    variant="soft"
                    label="Commit"
                    @click="setPoStatus(po, 'committed')"
                  />
                  <UButton
                    v-if="['approved', 'committed'].includes(po.status)"
                    size="xs"
                    variant="ghost"
                    label="Receive"
                    @click="openReceipt(po)"
                  />
                  <UButton
                    v-if="po.status === 'received'"
                    size="xs"
                    color="success"
                    variant="soft"
                    label="Close"
                    @click="setPoStatus(po, 'closed')"
                  />
                  <UButton
                    v-if="po.status === 'draft'"
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-trash-2"
                    aria-label="Delete"
                    @click="delPo(po)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!(poData?.items ?? []).length">
              <td :colspan="canManage ? 5 : 4" class="px-4 py-8 text-center text-muted">
                No purchase orders.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- VENDORS -->
    <div v-show="tab === 'vendors'" class="space-y-3">
      <div v-if="canManage" class="flex justify-end">
        <UButton size="sm" icon="i-lucide-plus" label="Add vendor" @click="openVendor()" />
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="v in pagedVendors" :key="v.id">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-medium text-default">{{ v.name }}</p>
              <p class="text-xs text-muted">{{ v.category || 'Vendor' }}</p>
            </div>
            <UBadge
              :color="v.status === 'active' ? 'success' : 'neutral'"
              variant="subtle"
              size="xs"
              :label="v.status"
            />
          </div>
          <p class="mt-2 text-xs text-muted">
            {{ v.contactName || '—' }}<span v-if="v.contactEmail"> · {{ v.contactEmail }}</span>
          </p>
          <a
            v-if="v.complianceDocUrl"
            :href="v.complianceDocUrl"
            target="_blank"
            class="mt-1 inline-flex items-center gap-1 text-xs text-primary"
          >
            <UIcon name="i-lucide-file-check" class="size-3" /> Compliance doc
          </a>
          <div v-if="canManage" class="mt-3 flex justify-end gap-1 border-t border-default pt-2">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              label="Edit"
              @click="openVendor(v)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Delete"
              @click="delVendor(v)"
            />
          </div>
        </UCard>
        <p v-if="!(vendorData?.items ?? []).length" class="text-sm text-muted">
          No vendors registered.
        </p>
      </div>
      <div v-if="(vendorData?.items?.length ?? 0) > venPageSize" class="flex justify-center pt-1">
        <UPagination
          v-model:page="venPage"
          :total="vendorData!.items.length"
          :items-per-page="venPageSize"
          :sibling-count="1"
        />
      </div>
    </div>

    <!-- RFQs -->
    <div v-show="tab === 'rfqs'" class="space-y-3">
      <div v-if="canManage" class="flex justify-end">
        <UButton size="sm" icon="i-lucide-plus" label="New RFQ" @click="openRfq()" />
      </div>
      <div class="space-y-3">
        <UCard v-for="r in rfqData?.items ?? []" :key="r.id">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-medium text-default">{{ r.title }}</p>
              <p class="text-xs text-muted">
                Due {{ fdate(r.dueDate) }} · {{ r.invitedVendors.length }} vendors invited
              </p>
            </div>
            <div class="flex items-center gap-1">
              <UBadge
                :color="RFQ_STATUS_COLOR[r.status]"
                variant="subtle"
                size="xs"
                :label="r.status"
              />
              <template v-if="canManage">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-pencil"
                  aria-label="Edit"
                  @click="openRfq(r)"
                />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  aria-label="Delete"
                  @click="delRfq(r)"
                />
              </template>
            </div>
          </div>
          <div v-if="r.invitedVendors.length" class="mt-2 flex flex-wrap gap-1">
            <UBadge
              v-for="v in r.invitedVendors"
              :key="v"
              variant="subtle"
              color="neutral"
              size="xs"
              :label="v"
            />
          </div>
          <p v-if="r.awardedVendor" class="mt-2 text-xs text-success">
            Awarded to {{ r.awardedVendor }}
          </p>
          <div v-else-if="canManage && r.invitedVendors.length" class="mt-2 flex flex-wrap gap-1">
            <UButton
              v-for="v in r.invitedVendors"
              :key="v"
              size="xs"
              variant="ghost"
              :label="`Award ${v}`"
              @click="awardRfq(r, v)"
            />
          </div>
        </UCard>
        <p v-if="!(rfqData?.items ?? []).length" class="text-sm text-muted">No RFQs.</p>
      </div>
    </div>

    <!-- CONTRACTS -->
    <div v-show="tab === 'contracts'" class="space-y-3">
      <div v-if="canManage" class="flex justify-end">
        <UButton size="sm" icon="i-lucide-plus" label="Add contract" @click="conOpen = true" />
      </div>
      <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Contract / Vendor</th>
              <th class="px-4 py-2 text-right font-medium">Value</th>
              <th class="hidden px-4 py-2 font-medium md:table-cell">Period</th>
              <th class="px-4 py-2 font-medium">Status</th>
              <th v-if="canManage" class="px-4 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="c in conData?.items ?? []" :key="c.id">
              <td class="px-4 py-2.5">
                <p class="font-medium text-default">{{ c.title }}</p>
                <p class="text-xs text-muted">{{ c.vendorName || '—' }}</p>
              </td>
              <td class="px-4 py-2.5 text-right text-default">{{ money(c.value, c.currency) }}</td>
              <td class="hidden px-4 py-2.5 text-muted md:table-cell">
                {{ fdate(c.startDate) }} – {{ fdate(c.endDate) }}
              </td>
              <td class="px-4 py-2.5">
                <UBadge
                  :color="CONTRACT_STATUS_COLOR[c.status]"
                  variant="subtle"
                  size="xs"
                  :label="c.status"
                />
              </td>
              <td v-if="canManage" class="px-4 py-2.5 text-right">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-pencil"
                    aria-label="Edit"
                    @click="openContract(c)"
                  />
                  <UButton
                    v-if="c.status !== 'terminated'"
                    size="xs"
                    variant="ghost"
                    color="warning"
                    label="Terminate"
                    @click="setContractStatus(c, 'terminated')"
                  />
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-trash-2"
                    aria-label="Delete"
                    @click="delContract(c)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!(conData?.items ?? []).length">
              <td :colspan="canManage ? 5 : 4" class="px-4 py-8 text-center text-muted">
                No contracts.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PO modal -->
    <UModal v-model:open="poOpen" title="Raise purchase order">
      <template #body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="PO number"
              ><UInput v-model="poForm.poNumber" placeholder="PO-2026-001" class="w-full"
            /></UFormField>
            <UFormField label="Currency"
              ><UInput v-model="poForm.currency" maxlength="3" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Title"><UInput v-model="poForm.title" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Vendor"
              ><USelect
                v-model="poForm.vendorId"
                :items="vendorItems"
                value-key="value"
                class="w-full"
            /></UFormField>
            <UFormField label="Project"
              ><USelect
                v-model="poForm.projectId"
                :items="projectItems"
                value-key="value"
                class="w-full"
            /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Budget category" hint="Rolls up on the project's budget">
              <USelectMenu
                v-model="poForm.budgetCategory"
                :items="budgetCategoryItems"
                create-item
                placeholder="Match a budget line"
                class="w-full"
                @create="(v: string) => (poForm.budgetCategory = v)"
              />
            </UFormField>
            <UFormField label="Expected date"
              ><UInput v-model="poForm.expectedDate" type="date" class="w-full"
            /></UFormField>
          </div>
          <div class="space-y-2">
            <p class="text-xs font-medium text-muted">Line items</p>
            <div v-for="(l, i) in poForm.lines" :key="i" class="flex gap-2">
              <UInput v-model="l.description" placeholder="Description" size="sm" class="flex-1" />
              <UInputNumber v-model="l.quantity" :min="0" size="sm" class="w-20" />
              <UInputNumber v-model="l.unitPrice" :min="0" size="sm" class="w-28" />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                aria-label="Remove"
                @click="poForm.lines.splice(i, 1)"
              />
            </div>
            <div class="flex items-center justify-between">
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add line"
                @click="poForm.lines.push({ description: '', quantity: 1, unitPrice: 0 })"
              />
              <span class="text-sm font-medium text-default"
                >Total: {{ money(poTotal, poForm.currency) }}</span
              >
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="poOpen = false" />
          <UButton label="Raise PO" :loading="busy" @click="createPo" />
        </div>
      </template>
    </UModal>

    <!-- Receipt modal -->
    <UModal v-model:open="receiptOpen" title="Record delivery receipt">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Received date"
            ><UInput v-model="receiptForm.receivedDate" type="date" class="w-full"
          /></UFormField>
          <UFormField
            ><UCheckbox
              v-model="receiptForm.complete"
              label="Complete delivery (marks PO received)"
          /></UFormField>
          <UFormField label="Note"><UInput v-model="receiptForm.note" class="w-full" /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="receiptOpen = false" />
          <UButton label="Record" :loading="busy" @click="saveReceipt" />
        </div>
      </template>
    </UModal>

    <!-- Vendor modal -->
    <UModal v-model:open="venOpen" :title="venForm.id ? 'Edit vendor' : 'Add vendor'">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name"><UInput v-model="venForm.name" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Category"
              ><UInput v-model="venForm.category" class="w-full"
            /></UFormField>
            <UFormField label="Tax ID"
              ><UInput v-model="venForm.taxId" class="w-full"
            /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Contact"
              ><UInput v-model="venForm.contactName" class="w-full"
            /></UFormField>
            <UFormField label="Email"
              ><UInput v-model="venForm.contactEmail" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Compliance doc URL"
            ><UInput v-model="venForm.complianceDocUrl" placeholder="https://…" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="venOpen = false" />
          <UButton :label="venForm.id ? 'Save' : 'Add'" :loading="busy" @click="saveVendor" />
        </div>
      </template>
    </UModal>

    <!-- RFQ modal -->
    <UModal v-model:open="rfqOpen" :title="rfqForm.id ? 'Edit RFQ' : 'New RFQ'">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title"><UInput v-model="rfqForm.title" class="w-full" /></UFormField>
          <UFormField label="Description"
            ><UTextarea v-model="rfqForm.description" :rows="2" class="w-full"
          /></UFormField>
          <UFormField label="Due date"
            ><UInput v-model="rfqForm.dueDate" type="date" class="w-full"
          /></UFormField>
          <UFormField label="Invited vendors" hint="comma-separated"
            ><UInput v-model="rfqForm.invited" placeholder="Vendor A, Vendor B" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="rfqOpen = false" />
          <UButton :label="rfqForm.id ? 'Save' : 'Issue'" :loading="busy" @click="saveRfq" />
        </div>
      </template>
    </UModal>

    <!-- Contract modal -->
    <UModal v-model:open="conOpen" :title="conForm.id ? 'Edit contract' : 'Add contract'">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title"><UInput v-model="conForm.title" class="w-full" /></UFormField>
          <UFormField label="Vendor"
            ><USelect
              v-model="conForm.vendorId"
              :items="vendorItems"
              value-key="value"
              class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Value"
              ><UInputNumber v-model="conForm.value" :min="0" class="w-full"
            /></UFormField>
            <UFormField label="Currency"
              ><UInput v-model="conForm.currency" maxlength="3" class="w-full"
            /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Start"
              ><UInput v-model="conForm.startDate" type="date" class="w-full"
            /></UFormField>
            <UFormField label="End"
              ><UInput v-model="conForm.endDate" type="date" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Document URL"
            ><UInput v-model="conForm.documentUrl" placeholder="https://…" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="conOpen = false" />
          <UButton :label="conForm.id ? 'Save' : 'Add'" :loading="busy" @click="saveContract" />
        </div>
      </template>
    </UModal>
  </div>
</template>
