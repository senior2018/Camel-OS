<script setup lang="ts">
import {
  CAMPAIGN_STATUS_COLOR,
  CAMPAIGN_STATUS_LABEL,
  CONTENT_STATUS_COLOR,
  CONTENT_STATUS_LABEL,
  type CampaignStatus,
  type ContentStatus,
} from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const canManage = computed(
  () => can.value('communications', 'update') || can.value('communications', 'approve')
)
const toast = useToast()

interface LinkedContent {
  id: string
  title: string
  type: string
  status: ContentStatus
  scheduledFor: string | null
  publishedAt: string | null
}
interface BudgetLine {
  id?: string
  label: string
  plannedAmount: string | number
  actualAmount: string | number
}
interface Campaign {
  id: string
  name: string
  objective: string | null
  audience: string | null
  startDate: string | null
  endDate: string | null
  budgetPlanned: string | null
  currency: string
  status: CampaignStatus
  ownerFirstName: string | null
  ownerLastName: string | null
  reportSummary: string | null
  closedAt: string | null
}
interface Summary {
  contentTotal: number
  contentPublished: number
  budgetPlanned: number
  budgetActual: number
  budgetVariance: number
}

const { data, refresh } = await useFetch<{
  campaign: Campaign
  content: LinkedContent[]
  budgetLines: BudgetLine[]
  summary: Summary
}>(`/api/communications/campaigns/${id}`, { key: `campaign-${id}` })
if (!data.value)
  throw createError({ statusCode: 404, statusMessage: 'Campaign not found', fatal: true })
useHead(() => ({ title: `${data.value?.campaign.name ?? 'Campaign'} — Camel OS` }))

const cur = computed(() => data.value?.campaign.currency ?? 'USD')
function money(v: number | string | null) {
  if (v == null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: cur.value,
    maximumFractionDigits: 0,
  }).format(Number(v))
}
function ownerName() {
  const c = data.value?.campaign
  return [c?.ownerFirstName, c?.ownerLastName].filter(Boolean).join(' ') || '—'
}
function fdate(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
}

// ── Budget editing ──
const lines = ref<BudgetLine[]>([])
watchEffect(() => {
  lines.value = (data.value?.budgetLines ?? []).map((l) => ({
    label: l.label,
    plannedAmount: Number(l.plannedAmount),
    actualAmount: Number(l.actualAmount),
  }))
})
function addLine() {
  lines.value.push({ label: '', plannedAmount: 0, actualAmount: 0 })
}
const plannedTotal = computed(() =>
  lines.value.reduce((s, l) => s + Number(l.plannedAmount || 0), 0)
)
const actualTotal = computed(() => lines.value.reduce((s, l) => s + Number(l.actualAmount || 0), 0))
const savingBudget = ref(false)
async function saveBudget() {
  savingBudget.value = true
  try {
    await $fetch(`/api/communications/campaigns/${id}/budget`, {
      method: 'PUT',
      body: {
        lines: lines.value
          .filter((l) => l.label.trim())
          .map((l) => ({
            label: l.label.trim(),
            plannedAmount: Number(l.plannedAmount || 0),
            actualAmount: Number(l.actualAmount || 0),
          })),
      },
    })
    toast.add({ title: 'Budget saved', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Could not save budget', color: 'error' })
  } finally {
    savingBudget.value = false
  }
}

// ── Close ──
const closeOpen = ref(false)
const reportSummary = ref('')
const closing = ref(false)
async function closeCampaign() {
  if (!reportSummary.value.trim()) {
    toast.add({ title: 'A closing summary is required', color: 'warning' })
    return
  }
  closing.value = true
  try {
    await $fetch(`/api/communications/campaigns/${id}/close`, {
      method: 'POST',
      body: { reportSummary: reportSummary.value.trim() },
    })
    toast.add({ title: 'Campaign closed', color: 'success' })
    closeOpen.value = false
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not close', description: msg, color: 'error' })
  } finally {
    closing.value = false
  }
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
          label="All campaigns"
          class="-ml-2"
          @click="navigateTo('/campaigns')"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight text-default">
            {{ data.campaign.name }}
          </h1>
          <UBadge
            :color="CAMPAIGN_STATUS_COLOR[data.campaign.status]"
            variant="subtle"
            :label="CAMPAIGN_STATUS_LABEL[data.campaign.status]"
          />
        </div>
        <p v-if="data.campaign.objective" class="mt-1 max-w-2xl text-sm text-muted">
          {{ data.campaign.objective }}
        </p>
      </div>
      <UButton
        v-if="canManage && data.campaign.status !== 'closed'"
        icon="i-lucide-flag"
        color="neutral"
        variant="outline"
        label="Close campaign"
        @click="closeOpen = true"
      />
    </div>

    <!-- Performance summary (CC-11) -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-xl border border-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Published / planned</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ data.summary.contentPublished
          }}<span class="text-base text-muted">/{{ data.summary.contentTotal }}</span>
        </p>
      </div>
      <div class="rounded-xl border border-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Budget planned</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ money(data.summary.budgetPlanned) }}
        </p>
      </div>
      <div class="rounded-xl border border-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Actual spend</p>
        <p class="mt-1 text-2xl font-semibold text-info">{{ money(data.summary.budgetActual) }}</p>
      </div>
      <div class="rounded-xl border border-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Variance</p>
        <p
          class="mt-1 text-2xl font-semibold"
          :class="data.summary.budgetVariance < 0 ? 'text-error' : 'text-success'"
        >
          {{ money(data.summary.budgetVariance) }}
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <!-- Budget (CC-12) -->
      <div class="lg:col-span-2">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Budget — planned vs actual</h3>
              <UButton
                v-if="canManage"
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add line"
                @click="addLine"
              />
            </div>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="py-1.5 pr-2 font-medium">Line</th>
                  <th class="py-1.5 px-2 text-right font-medium">Planned</th>
                  <th class="py-1.5 px-2 text-right font-medium">Actual</th>
                  <th class="py-1.5 pl-2 text-right font-medium">Variance</th>
                  <th v-if="canManage" />
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="(l, i) in lines" :key="i">
                  <td class="py-1.5 pr-2">
                    <UInput
                      v-model="l.label"
                      size="sm"
                      placeholder="e.g. Paid promotion"
                      :disabled="!canManage"
                    />
                  </td>
                  <td class="py-1.5 px-2">
                    <UInputNumber
                      v-model="l.plannedAmount as number"
                      :min="0"
                      size="sm"
                      :disabled="!canManage"
                      class="w-28"
                    />
                  </td>
                  <td class="py-1.5 px-2">
                    <UInputNumber
                      v-model="l.actualAmount as number"
                      :min="0"
                      size="sm"
                      :disabled="!canManage"
                      class="w-28"
                    />
                  </td>
                  <td
                    class="py-1.5 pl-2 text-right"
                    :class="
                      Number(l.plannedAmount) - Number(l.actualAmount) < 0
                        ? 'text-error'
                        : 'text-muted'
                    "
                  >
                    {{ money(Number(l.plannedAmount) - Number(l.actualAmount)) }}
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
                  <td colspan="5" class="py-3 text-center text-sm text-muted">
                    No budget lines yet.
                  </td>
                </tr>
              </tbody>
              <tfoot class="border-t border-default font-medium">
                <tr>
                  <td class="py-2 pr-2 text-default">Total</td>
                  <td class="py-2 px-2 text-right text-default">{{ money(plannedTotal) }}</td>
                  <td class="py-2 px-2 text-right text-default">{{ money(actualTotal) }}</td>
                  <td
                    class="py-2 pl-2 text-right"
                    :class="plannedTotal - actualTotal < 0 ? 'text-error' : 'text-success'"
                  >
                    {{ money(plannedTotal - actualTotal) }}
                  </td>
                  <td v-if="canManage" />
                </tr>
              </tfoot>
            </table>
          </div>
          <div v-if="canManage" class="mt-3 flex justify-end">
            <UButton size="sm" label="Save budget" :loading="savingBudget" @click="saveBudget" />
          </div>
        </UCard>

        <UCard class="mt-4">
          <template #header>
            <h3 class="text-sm font-semibold text-default">
              Linked content ({{ data.content.length }})
            </h3>
          </template>
          <div v-if="!data.content.length" class="text-sm text-muted">
            No content linked yet. Open a content item and set its <strong>Campaign</strong> to link
            it here.
          </div>
          <ul v-else class="divide-y divide-default">
            <li
              v-for="c in data.content"
              :key="c.id"
              class="flex cursor-pointer items-center justify-between gap-2 py-2 hover:bg-elevated/40"
              @click="navigateTo(`/communications/${c.id}`)"
            >
              <span class="truncate text-sm font-medium text-default">{{ c.title }}</span>
              <UBadge
                :color="CONTENT_STATUS_COLOR[c.status]"
                variant="subtle"
                size="xs"
                :label="CONTENT_STATUS_LABEL[c.status]"
              />
            </li>
          </ul>
        </UCard>
      </div>

      <!-- Sidebar -->
      <div class="space-y-4">
        <UCard>
          <template #header><h3 class="text-sm font-semibold text-default">Details</h3></template>
          <dl class="space-y-1.5 text-sm">
            <div class="flex justify-between gap-2">
              <dt class="text-muted">Owner</dt>
              <dd class="text-default">{{ ownerName() }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted">Audience</dt>
              <dd class="text-right text-default">{{ data.campaign.audience || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted">Start</dt>
              <dd class="text-default">{{ fdate(data.campaign.startDate) }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted">End</dt>
              <dd class="text-default">{{ fdate(data.campaign.endDate) }}</dd>
            </div>
          </dl>
        </UCard>

        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Engagement</h3></template
          >
          <p class="text-sm text-muted">
            Reach and engagement aggregate from per-content metrics (added in the next sprint).
          </p>
        </UCard>

        <UCard v-if="data.campaign.status === 'closed' && data.campaign.reportSummary">
          <template #header
            ><h3 class="text-sm font-semibold text-default">Final report</h3></template
          >
          <p class="whitespace-pre-wrap text-sm text-default">{{ data.campaign.reportSummary }}</p>
          <p class="mt-2 text-xs text-dimmed">Closed {{ fdate(data.campaign.closedAt) }}</p>
        </UCard>
      </div>
    </div>

    <UModal v-model:open="closeOpen" title="Close campaign">
      <template #body>
        <UFormField
          label="Final report"
          hint="Objective, outputs, reach, and recommendations."
          required
        >
          <UTextarea
            v-model="reportSummary"
            :rows="6"
            class="w-full"
            placeholder="Summarise the campaign outcomes…"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="closeOpen = false" />
          <UButton label="Close & generate report" :loading="closing" @click="closeCampaign" />
        </div>
      </template>
    </UModal>
  </div>
</template>
