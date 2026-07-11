<script setup lang="ts">
import {
  EXPENSE_CLAIM_STATUS_COLOR,
  EXPENSE_CLAIM_STATUS_LABEL,
  ORG_BUDGET_STATUS_COLOR,
  ORG_BUDGET_STATUS_LABEL,
  VENDOR_INVOICE_STATUS_COLOR,
  VENDOR_INVOICE_STATUS_LABEL,
  type ExpenseClaimStatus,
  type OrgBudgetStatus,
  type VendorInvoiceStatus,
} from '@@/shared/schemas/finance'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Finance — Camel OS' })

const { can } = await usePermissions()
if (!can.value('finance', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access to Finance', fatal: true })
}
const canManage = computed(() => can.value('finance', 'create') || can.value('finance', 'update'))
const toast = useToast()

const tab = ref<'budget' | 'portfolio' | 'claims' | 'invoices' | 'reports'>('budget')
const tabs = [
  { key: 'budget', label: 'Budget', icon: 'i-lucide-wallet' },
  { key: 'portfolio', label: 'Portfolio & Forecast', icon: 'i-lucide-trending-up' },
  { key: 'claims', label: 'Expense Claims', icon: 'i-lucide-receipt' },
  { key: 'invoices', label: 'Vendor Invoices', icon: 'i-lucide-file-text' },
  { key: 'reports', label: 'Reports', icon: 'i-lucide-bar-chart-3' },
] as const

const busy = ref(false)
async function call<T = unknown>(fn: () => Promise<T>, ok?: string) {
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
function money(v: number | string | null, cur = 'USD') {
  return v == null
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: 0,
      }).format(Number(v))
}
function fdate(s: string | null) {
  return s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
}
const uname = (f: string | null, l: string | null) => [f, l].filter(Boolean).join(' ') || '—'

// ── Budget (FN-01/04) ──
interface Budget {
  id: string
  fiscalYear: number
  name: string
  status: OrgBudgetStatus
  currency: string
}
const { data: budgetData, refresh: refreshBudget } = await useFetch<{
  budgets: Budget[]
  selectedId: string | null
  lines: { id: string; category: string; allocatedAmount: string; note: string | null }[]
  actualByCategory: Record<string, number>
}>('/api/finance/budget', {
  key: 'finance-budget',
  default: () => ({ budgets: [], selectedId: null, lines: [], actualByCategory: {} }),
})

const activeBudget = computed(() =>
  budgetData.value?.budgets.find((b) => b.id === budgetData.value?.selectedId)
)
const cur = computed(() => activeBudget.value?.currency ?? 'USD')
const lines = ref<{ category: string; allocatedAmount: number; note: string }[]>([])
watchEffect(() => {
  lines.value = (budgetData.value?.lines ?? []).map((l) => ({
    category: l.category,
    allocatedAmount: Number(l.allocatedAmount),
    note: l.note ?? '',
  }))
})
const actual = (cat: string) => budgetData.value?.actualByCategory[cat] ?? 0
const budgetTotal = computed(() => lines.value.reduce((s, l) => s + (l.allocatedAmount || 0), 0))

const newBudgetOpen = ref(false)
const nbForm = reactive({ fiscalYear: new Date().getFullYear(), name: '', currency: 'USD' })
async function createBudget() {
  if (
    await call(
      () => $fetch('/api/finance/budget', { method: 'POST', body: { ...nbForm } }),
      'Budget created'
    )
  ) {
    newBudgetOpen.value = false
    await refreshBudget()
  }
}
async function saveBudget() {
  const id = budgetData.value?.selectedId
  if (!id) return
  await call(
    () =>
      $fetch(`/api/finance/budget/${id}`, {
        method: 'PUT',
        body: {
          lines: lines.value.map((l) => ({
            category: l.category,
            allocatedAmount: l.allocatedAmount,
            note: l.note || null,
          })),
        },
      }),
    'Budget saved'
  )
  await refreshBudget()
}
async function setBudgetStatus(s: OrgBudgetStatus) {
  const id = budgetData.value?.selectedId
  if (!id) return
  await call(
    () => $fetch(`/api/finance/budget/${id}`, { method: 'PUT', body: { status: s } }),
    'Budget updated'
  )
  await refreshBudget()
}

// ── Expense claims (FN-02) ──
interface Claim {
  id: string
  title: string
  category: string | null
  amount: string
  currency: string
  incurredDate: string
  status: ExpenseClaimStatus
  projectName: string | null
  claimantFirstName: string | null
  claimantLastName: string | null
  decisionNote: string | null
}
const { data: claimData, refresh: refreshClaims } = await useFetch<{
  items: Claim[]
  canManage: boolean
}>('/api/finance/expense-claims', {
  key: 'finance-claims',
  default: () => ({ items: [], canManage: false }),
})
async function decideClaim(c: Claim, decision: 'approved' | 'rejected' | 'paid') {
  await call(
    () => $fetch(`/api/finance/expense-claims/${c.id}`, { method: 'PATCH', body: { decision } }),
    `Claim ${decision}`
  )
  await refreshClaims()
}

// ── Vendor invoices (FN-03) ──
interface Invoice {
  id: string
  vendorName: string
  invoiceNumber: string
  amount: string
  currency: string
  invoiceDate: string
  dueDate: string | null
  poReference: string | null
  budgetCategory: string | null
  status: VendorInvoiceStatus
  projectName: string | null
}
const { data: invData, refresh: refreshInv } = await useFetch<{ items: Invoice[] }>(
  '/api/finance/invoices',
  {
    key: 'finance-invoices',
    default: () => ({ items: [] }),
  }
)
const newInvOpen = ref(false)
const invForm = reactive({
  vendorName: '',
  invoiceNumber: '',
  amount: null as number | null,
  currency: 'USD',
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  poReference: '',
  budgetCategory: '',
})
async function createInvoice() {
  if (invForm.amount == null || !invForm.vendorName.trim()) return
  if (
    await call(
      () =>
        $fetch('/api/finance/invoices', {
          method: 'POST',
          body: {
            vendorName: invForm.vendorName,
            invoiceNumber: invForm.invoiceNumber,
            amount: invForm.amount,
            currency: invForm.currency || 'USD',
            invoiceDate: invForm.invoiceDate,
            dueDate: invForm.dueDate || null,
            poReference: invForm.poReference || null,
            budgetCategory: invForm.budgetCategory || null,
          },
        }),
      'Invoice recorded'
    )
  ) {
    newInvOpen.value = false
    Object.assign(invForm, {
      vendorName: '',
      invoiceNumber: '',
      amount: null,
      dueDate: '',
      poReference: '',
      budgetCategory: '',
    })
    await refreshInv()
  }
}
async function setInvStatus(inv: Invoice, status: VendorInvoiceStatus) {
  await call(
    () => $fetch(`/api/finance/invoices/${inv.id}`, { method: 'PATCH', body: { status } }),
    'Invoice updated'
  )
  await refreshInv()
}

// ── Reports (FN-04/05) ──
interface Reports {
  currency: string
  expenditureByCategory: Record<string, number>
  budgetVsActual: { category: string; allocated: number; actual: number }[]
  costToProject: {
    projectId: string
    name: string
    expenses: number
    invoices: number
    claims: number
    labourHours: number
    total: number
  }[]
}
const { data: repData } = await useFetch<Reports>('/api/finance/reports', {
  key: 'finance-reports',
  default: () => ({
    currency: 'USD',
    expenditureByCategory: {},
    budgetVsActual: [],
    costToProject: [],
  }),
})

// ── Portfolio & forecast (FN-06/07/08/09/10) ──
interface PortfolioRow {
  projectId: string
  name: string
  status: string
  currency: string
  budget: number
  spent: number
  burn: number
  alertThreshold: number
  overThreshold: boolean
  rag: 'success' | 'warning' | 'error'
}
const { data: portData, refresh: refreshPort } = await useFetch<{
  currency: string
  portfolio: PortfolioRow[]
  forecast: {
    allocated: number
    spentToDate: number
    monthsElapsed: number
    forecastYearEnd: number
    overBudget: boolean
  }
}>('/api/finance/portfolio', {
  key: 'finance-portfolio',
  default: () => ({
    currency: 'USD',
    portfolio: [],
    forecast: {
      allocated: 0,
      spentToDate: 0,
      monthsElapsed: 1,
      forecastYearEnd: 0,
      overBudget: false,
    },
  }),
})
const ragText = (r: string) =>
  ({ success: 'text-success', warning: 'text-warning', error: 'text-error' })[r] ?? 'text-muted'
async function setThreshold(p: PortfolioRow, value: number) {
  if (value === p.alertThreshold) return
  await call(
    () =>
      $fetch(`/api/finance/portfolio/${p.projectId}`, {
        method: 'PATCH',
        body: { budgetAlertThreshold: value },
      }),
    'Alert threshold saved'
  )
  await refreshPort()
}
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Finance</h1>
        <p class="mt-1 text-sm text-muted">
          Organisational budget, staff expense claims, vendor invoices, and financial reports.
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

    <!-- BUDGET -->
    <div v-show="tab === 'budget'" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold text-default">
            {{
              activeBudget ? `${activeBudget.name} · FY${activeBudget.fiscalYear}` : 'No budget yet'
            }}
          </h2>
          <UBadge
            v-if="activeBudget"
            :color="ORG_BUDGET_STATUS_COLOR[activeBudget.status]"
            variant="subtle"
            size="xs"
            :label="ORG_BUDGET_STATUS_LABEL[activeBudget.status]"
          />
        </div>
        <div v-if="canManage" class="flex gap-2">
          <UButton
            v-if="activeBudget && activeBudget.status === 'draft'"
            size="xs"
            color="success"
            variant="soft"
            label="Activate"
            @click="setBudgetStatus('active')"
          />
          <UButton
            size="xs"
            icon="i-lucide-plus"
            label="New budget"
            @click="newBudgetOpen = true"
          />
        </div>
      </div>

      <UCard v-if="activeBudget">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-default">Budget vs actual</h3>
            <span class="text-xs text-muted">Total allocated: {{ money(budgetTotal, cur) }}</span>
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="py-1.5 pr-2 font-medium">Category</th>
                <th class="px-2 py-1.5 text-right font-medium">Allocated</th>
                <th class="px-2 py-1.5 text-right font-medium">Actual</th>
                <th class="px-2 py-1.5 text-right font-medium">Variance</th>
                <th v-if="canManage" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="(l, i) in lines" :key="i">
                <td class="py-1.5 pr-2">
                  <UInput v-if="canManage" v-model="l.category" size="sm" placeholder="Category" />
                  <span v-else class="text-default">{{ l.category }}</span>
                </td>
                <td class="px-2 py-1.5 text-right">
                  <UInputNumber
                    v-if="canManage"
                    v-model="l.allocatedAmount"
                    :min="0"
                    size="sm"
                    class="w-32"
                  />
                  <span v-else>{{ money(l.allocatedAmount, cur) }}</span>
                </td>
                <td class="px-2 py-1.5 text-right text-muted">
                  {{ money(actual(l.category), cur) }}
                </td>
                <td
                  class="px-2 py-1.5 text-right font-medium"
                  :class="
                    l.allocatedAmount - actual(l.category) < 0 ? 'text-error' : 'text-success'
                  "
                >
                  {{ money(l.allocatedAmount - actual(l.category), cur) }}
                </td>
                <td v-if="canManage" class="text-right">
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-x"
                    aria-label="Remove"
                    @click="lines.splice(i, 1)"
                  />
                </td>
              </tr>
              <tr v-if="!lines.length">
                <td :colspan="canManage ? 5 : 4" class="py-3 text-center text-muted">
                  No budget lines yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="canManage" class="mt-3 flex justify-between">
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-plus"
            label="Add line"
            @click="lines.push({ category: '', allocatedAmount: 0, note: '' })"
          />
          <UButton size="sm" label="Save budget" :loading="busy" @click="saveBudget" />
        </div>
      </UCard>
      <div
        v-else
        class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted"
      >
        No budget for this year yet.<span v-if="canManage"> Create one to start tracking.</span>
      </div>
    </div>

    <!-- PORTFOLIO & FORECAST -->
    <div v-show="tab === 'portfolio'" class="space-y-4">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Budget allocated</p>
          <p class="mt-1 text-xl font-semibold text-default">
            {{ money(portData?.forecast.allocated, portData?.currency) }}
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Spent to date</p>
          <p class="mt-1 text-xl font-semibold text-default">
            {{ money(portData?.forecast.spentToDate, portData?.currency) }}
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Forecast year-end</p>
          <p
            class="mt-1 text-xl font-semibold"
            :class="portData?.forecast.overBudget ? 'text-error' : 'text-success'"
          >
            {{ money(portData?.forecast.forecastYearEnd, portData?.currency) }}
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Run-rate basis</p>
          <p class="mt-1 text-xl font-semibold text-default">
            {{ portData?.forecast.monthsElapsed }} mo
          </p>
        </div>
      </div>

      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-default">Portfolio burn rate</h3>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="py-1.5 pr-2 font-medium">Project</th>
                <th class="px-2 py-1.5 text-right font-medium">Budget</th>
                <th class="px-2 py-1.5 text-right font-medium">Spent</th>
                <th class="px-2 py-1.5 text-right font-medium">Burn</th>
                <th class="px-2 py-1.5 text-right font-medium">Alert %</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="p in portData?.portfolio ?? []" :key="p.projectId">
                <td class="py-1.5 pr-2">
                  <NuxtLink
                    :to="`/projects/${p.projectId}`"
                    class="text-default hover:text-primary"
                    >{{ p.name }}</NuxtLink
                  >
                  <UIcon
                    v-if="p.overThreshold"
                    name="i-lucide-alert-triangle"
                    class="ml-1 inline size-3.5 text-warning"
                  />
                </td>
                <td class="px-2 py-1.5 text-right text-muted">{{ money(p.budget, p.currency) }}</td>
                <td class="px-2 py-1.5 text-right text-default">
                  {{ money(p.spent, p.currency) }}
                </td>
                <td class="px-2 py-1.5 text-right font-medium" :class="ragText(p.rag)">
                  {{ p.burn }}%
                </td>
                <td class="px-2 py-1.5 text-right">
                  <UInputNumber
                    v-if="canManage"
                    :model-value="p.alertThreshold"
                    :min="1"
                    :max="200"
                    size="xs"
                    class="w-20"
                    @update:model-value="(v: number) => setThreshold(p, v)"
                  />
                  <span v-else>{{ p.alertThreshold }}%</span>
                </td>
              </tr>
              <tr v-if="!(portData?.portfolio ?? []).length">
                <td colspan="5" class="py-3 text-center text-muted">No projects yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- EXPENSE CLAIMS -->
    <div v-show="tab === 'claims'" class="space-y-3">
      <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Claim</th>
              <th class="hidden px-4 py-2 font-medium md:table-cell">Claimant</th>
              <th class="px-4 py-2 text-right font-medium">Amount</th>
              <th class="px-4 py-2 font-medium">Status</th>
              <th v-if="claimData?.canManage" class="px-4 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="c in claimData?.items ?? []" :key="c.id">
              <td class="px-4 py-2.5">
                <p class="font-medium text-default">{{ c.title }}</p>
                <p class="text-xs text-muted">
                  {{ fdate(c.incurredDate) }}<span v-if="c.category"> · {{ c.category }}</span
                  ><span v-if="c.projectName"> · {{ c.projectName }}</span>
                </p>
              </td>
              <td class="hidden px-4 py-2.5 text-muted md:table-cell">
                {{ uname(c.claimantFirstName, c.claimantLastName) }}
              </td>
              <td class="px-4 py-2.5 text-right text-default">{{ money(c.amount, c.currency) }}</td>
              <td class="px-4 py-2.5">
                <UBadge
                  :color="EXPENSE_CLAIM_STATUS_COLOR[c.status]"
                  variant="subtle"
                  size="xs"
                  :label="EXPENSE_CLAIM_STATUS_LABEL[c.status]"
                />
              </td>
              <td v-if="claimData?.canManage" class="px-4 py-2.5 text-right">
                <div class="flex justify-end gap-1">
                  <UButton
                    v-if="c.status === 'submitted'"
                    size="xs"
                    color="success"
                    variant="soft"
                    label="Approve"
                    @click="decideClaim(c, 'approved')"
                  />
                  <UButton
                    v-if="c.status === 'submitted'"
                    size="xs"
                    color="error"
                    variant="ghost"
                    label="Reject"
                    @click="decideClaim(c, 'rejected')"
                  />
                  <UButton
                    v-if="c.status === 'approved'"
                    size="xs"
                    color="primary"
                    variant="soft"
                    label="Mark paid"
                    @click="decideClaim(c, 'paid')"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!(claimData?.items ?? []).length">
              <td :colspan="claimData?.canManage ? 5 : 4" class="px-4 py-8 text-center text-muted">
                No expense claims.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted">
        Staff file claims from <NuxtLink to="/expenses" class="text-primary">My Expenses</NuxtLink>.
      </p>
    </div>

    <!-- VENDOR INVOICES -->
    <div v-show="tab === 'invoices'" class="space-y-3">
      <div v-if="canManage" class="flex justify-end">
        <UButton size="sm" icon="i-lucide-plus" label="Record invoice" @click="newInvOpen = true" />
      </div>
      <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Vendor / Invoice</th>
              <th class="hidden px-4 py-2 font-medium md:table-cell">PO ref</th>
              <th class="px-4 py-2 text-right font-medium">Amount</th>
              <th class="px-4 py-2 font-medium">Status</th>
              <th v-if="canManage" class="px-4 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="inv in invData?.items ?? []" :key="inv.id">
              <td class="px-4 py-2.5">
                <p class="font-medium text-default">{{ inv.vendorName }}</p>
                <p class="text-xs text-muted">
                  #{{ inv.invoiceNumber }} · {{ fdate(inv.invoiceDate)
                  }}<span v-if="inv.projectName"> · {{ inv.projectName }}</span>
                </p>
              </td>
              <td class="hidden px-4 py-2.5 text-muted md:table-cell">
                {{ inv.poReference || '—' }}
              </td>
              <td class="px-4 py-2.5 text-right text-default">
                {{ money(inv.amount, inv.currency) }}
              </td>
              <td class="px-4 py-2.5">
                <UBadge
                  :color="VENDOR_INVOICE_STATUS_COLOR[inv.status]"
                  variant="subtle"
                  size="xs"
                  :label="VENDOR_INVOICE_STATUS_LABEL[inv.status]"
                />
              </td>
              <td v-if="canManage" class="px-4 py-2.5 text-right">
                <div class="flex justify-end gap-1">
                  <UButton
                    v-if="inv.status === 'pending'"
                    size="xs"
                    variant="soft"
                    label="Approve"
                    @click="setInvStatus(inv, 'approved')"
                  />
                  <UButton
                    v-if="inv.status === 'approved'"
                    size="xs"
                    color="success"
                    variant="soft"
                    label="Mark paid"
                    @click="setInvStatus(inv, 'paid')"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!(invData?.items ?? []).length">
              <td :colspan="canManage ? 5 : 4" class="px-4 py-8 text-center text-muted">
                No invoices recorded.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- REPORTS -->
    <div v-show="tab === 'reports'" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <UCard>
        <template #header
          ><h3 class="text-sm font-semibold text-default">Expenditure by category</h3></template
        >
        <ul class="space-y-1.5 text-sm">
          <li
            v-for="(v, k) in repData?.expenditureByCategory ?? {}"
            :key="k"
            class="flex justify-between"
          >
            <span class="text-default">{{ k }}</span
            ><span class="font-medium text-default">{{ money(v, repData?.currency) }}</span>
          </li>
          <li v-if="!Object.keys(repData?.expenditureByCategory ?? {}).length" class="text-muted">
            No expenditure yet.
          </li>
        </ul>
      </UCard>
      <UCard>
        <template #header
          ><h3 class="text-sm font-semibold text-default">Cost to project (FN-05)</h3></template
        >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="py-1 pr-2 font-medium">Project</th>
                <th class="px-2 py-1 text-right font-medium">Cost</th>
                <th class="px-2 py-1 text-right font-medium">Labour (h)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="p in repData?.costToProject ?? []" :key="p.projectId">
                <td class="py-1.5 pr-2 text-default">{{ p.name }}</td>
                <td class="px-2 py-1.5 text-right text-default">
                  {{ money(p.total, repData?.currency) }}
                </td>
                <td class="px-2 py-1.5 text-right text-muted">{{ p.labourHours }}h</td>
              </tr>
              <tr v-if="!(repData?.costToProject ?? []).length">
                <td colspan="3" class="py-3 text-center text-muted">No project costs yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- Modals -->
    <UModal v-model:open="newBudgetOpen" title="New annual budget">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Fiscal year"
            ><UInputNumber v-model="nbForm.fiscalYear" :min="2000" :max="2100" class="w-full"
          /></UFormField>
          <UFormField label="Name"
            ><UInput
              v-model="nbForm.name"
              placeholder="e.g. Annual Operating Budget"
              class="w-full"
          /></UFormField>
          <UFormField label="Currency"
            ><UInput v-model="nbForm.currency" maxlength="3" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="newBudgetOpen = false" />
          <UButton label="Create" :loading="busy" @click="createBudget" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="newInvOpen" title="Record vendor invoice">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Vendor"
            ><UInput v-model="invForm.vendorName" class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Invoice #"
              ><UInput v-model="invForm.invoiceNumber" class="w-full"
            /></UFormField>
            <UFormField label="Amount"
              ><UInputNumber v-model="invForm.amount" :min="0" class="w-full"
            /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Invoice date"
              ><UInput v-model="invForm.invoiceDate" type="date" class="w-full"
            /></UFormField>
            <UFormField label="Due date"
              ><UInput v-model="invForm.dueDate" type="date" class="w-full"
            /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="PO reference"
              ><UInput v-model="invForm.poReference" placeholder="Optional" class="w-full"
            /></UFormField>
            <UFormField label="Budget category"
              ><UInput v-model="invForm.budgetCategory" placeholder="Optional" class="w-full"
            /></UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="newInvOpen = false" />
          <UButton label="Record" :loading="busy" @click="createInvoice" />
        </div>
      </template>
    </UModal>
  </div>
</template>
