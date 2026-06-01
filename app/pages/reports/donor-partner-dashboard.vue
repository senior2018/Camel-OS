<script setup lang="ts">
import { CLIENT_INTERACTION_TYPE_LABEL, type ClientType } from '@@/shared/schemas/client'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Donor & partner relationships — Camel OS' })

const { can } = await usePermissions()
if (!can.value('crm', 'read')) {
  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have permission to view CRM reports.',
    fatal: true,
  })
}

interface CurrencyTotal {
  currency: string
  amount: string
}

interface DashboardData {
  totals: { donors: number; partners: number }
  activeGrants: { count: number; totalsByCurrency: CurrencyTotal[] }
  activeAgreements: { count: number; totalsByCurrency: CurrencyTotal[] }
  upcomingGrants: Array<{
    id: string
    title: string
    endDate: string | null
    donorId: string
    donorName: string
    totalValue: string | null
    currency: string
  }>
  upcomingRenewals: Array<{
    id: string
    title: string
    endDate: string | null
    partnerId: string
    partnerName: string
    value: string | null
    currency: string
  }>
  commTypeStats: Array<{
    type: keyof typeof CLIENT_INTERACTION_TYPE_LABEL
    count: number
  }>
  recentComms: Array<{
    id: string
    type: keyof typeof CLIENT_INTERACTION_TYPE_LABEL
    occurredAt: string
    summary: string
    clientId: string
    clientName: string
    clientType: ClientType
  }>
  atRiskClients: Array<{
    id: string
    name: string
    type: ClientType
    lastInteractionAt: string | null
  }>
}

const { data, status, refresh } = await useFetch<DashboardData>(
  '/api/reports/donor-partner-dashboard',
  { key: 'donor-partner-dashboard' }
)

function formatMoney(amount: string | null, currency: string): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return `${amount} ${currency}`
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
}

function daysSince(date: string | null): number | null {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">
          Donor &amp; partner dashboard
        </h1>
        <p class="mt-1 text-sm text-muted">
          Funding pipeline, renewal radar, and engagement health for every donor and partner.
        </p>
      </div>
      <UButton
        variant="outline"
        icon="i-lucide-refresh-cw"
        label="Refresh"
        size="sm"
        @click="() => refresh()"
      />
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else-if="data">
      <!-- Headline cards -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">Donors</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ data.totals.donors }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">Partners</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ data.totals.partners }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">Active grants</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ data.activeGrants.count }}</p>
          <p
            v-if="data.activeGrants.totalsByCurrency.length"
            class="mt-1 truncate text-xs text-muted"
          >
            <span v-for="(t, i) in data.activeGrants.totalsByCurrency" :key="t.currency"
              ><span v-if="i > 0">, </span>{{ formatMoney(t.amount, t.currency) }}</span
            >
          </p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">Active agreements</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ data.activeAgreements.count }}</p>
          <p
            v-if="data.activeAgreements.totalsByCurrency.length"
            class="mt-1 truncate text-xs text-muted"
          >
            <span v-for="(t, i) in data.activeAgreements.totalsByCurrency" :key="t.currency"
              ><span v-if="i > 0">, </span>{{ formatMoney(t.amount, t.currency) }}</span
            >
          </p>
        </UCard>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Upcoming grant deadlines -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Upcoming grant deadlines (60 days)</h3>
              <UBadge variant="subtle" color="neutral" size="sm">
                {{ data.upcomingGrants.length }}
              </UBadge>
            </div>
          </template>
          <div v-if="!data.upcomingGrants.length" class="py-6 text-center text-sm text-muted">
            No grants are reaching their end date in the next 60 days.
          </div>
          <ul v-else class="divide-y divide-default">
            <li v-for="g in data.upcomingGrants" :key="g.id" class="py-3 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink
                  :to="`/clients/${g.donorId}`"
                  class="font-medium text-default hover:underline"
                  >{{ g.donorName }}</NuxtLink
                >
                <span class="text-dimmed">·</span>
                <span class="text-default">{{ g.title }}</span>
                <UBadge
                  v-if="(daysUntil(g.endDate) ?? 0) <= 30"
                  color="warning"
                  variant="subtle"
                  size="xs"
                  label="≤30 days"
                />
              </div>
              <div class="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                <span>End {{ g.endDate || '—' }} ({{ daysUntil(g.endDate) }} days)</span>
                <span v-if="g.totalValue">· {{ formatMoney(g.totalValue, g.currency) }}</span>
              </div>
            </li>
          </ul>
        </UCard>

        <!-- Upcoming partnership renewals -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">
                Upcoming partnership renewals (90 days)
              </h3>
              <UBadge variant="subtle" color="neutral" size="sm">
                {{ data.upcomingRenewals.length }}
              </UBadge>
            </div>
          </template>
          <div v-if="!data.upcomingRenewals.length" class="py-6 text-center text-sm text-muted">
            No partnership agreements due to expire in the next 90 days.
          </div>
          <ul v-else class="divide-y divide-default">
            <li v-for="a in data.upcomingRenewals" :key="a.id" class="py-3 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink
                  :to="`/clients/${a.partnerId}`"
                  class="font-medium text-default hover:underline"
                  >{{ a.partnerName }}</NuxtLink
                >
                <span class="text-dimmed">·</span>
                <span class="text-default">{{ a.title }}</span>
                <UBadge
                  v-if="(daysUntil(a.endDate) ?? 0) <= 30"
                  color="warning"
                  variant="subtle"
                  size="xs"
                  label="≤30 days"
                />
                <UBadge
                  v-else-if="(daysUntil(a.endDate) ?? 0) <= 90"
                  color="primary"
                  variant="subtle"
                  size="xs"
                  label="≤90 days"
                />
              </div>
              <div class="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                <span>Expires {{ a.endDate || '—' }} ({{ daysUntil(a.endDate) }} days)</span>
                <span v-if="a.value">· {{ formatMoney(a.value, a.currency) }}</span>
              </div>
            </li>
          </ul>
        </UCard>

        <!-- Communication mix (last 90d) -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold text-default">Communication mix (last 90 days)</h3>
          </template>
          <div v-if="!data.commTypeStats.length" class="py-6 text-center text-sm text-muted">
            No communications logged in the last 90 days.
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="row in data.commTypeStats"
              :key="row.type"
              class="flex items-center justify-between rounded-md bg-elevated/40 px-3 py-2 text-sm"
            >
              <span class="text-default">{{ CLIENT_INTERACTION_TYPE_LABEL[row.type] }}</span>
              <UBadge variant="subtle" color="neutral" size="sm">{{ row.count }}</UBadge>
            </li>
          </ul>
        </UCard>

        <!-- Recent communications -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold text-default">Recent communications</h3>
          </template>
          <div v-if="!data.recentComms.length" class="py-6 text-center text-sm text-muted">
            No donor or partner communications logged yet.
          </div>
          <ul v-else class="divide-y divide-default">
            <li v-for="c in data.recentComms" :key="c.id" class="py-3 text-sm">
              <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
                <UBadge
                  variant="subtle"
                  color="neutral"
                  size="xs"
                  :label="CLIENT_INTERACTION_TYPE_LABEL[c.type]"
                />
                <NuxtLink
                  :to="`/clients/${c.clientId}`"
                  class="font-medium text-default hover:underline"
                  >{{ c.clientName }}</NuxtLink
                >
                <span class="text-dimmed">·</span>
                <span>{{ formatDateTime(c.occurredAt) }}</span>
              </div>
              <p class="mt-1 line-clamp-2 text-default">{{ c.summary }}</p>
            </li>
          </ul>
        </UCard>
      </div>

      <!-- At-risk relationships -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-default">At-risk relationships</h3>
              <p class="mt-0.5 text-xs text-muted">
                Donors and partners with no recorded interaction in the last 60 days.
              </p>
            </div>
            <UBadge variant="subtle" color="error" size="sm">
              {{ data.atRiskClients.length }}
            </UBadge>
          </div>
        </template>
        <div v-if="!data.atRiskClients.length" class="py-6 text-center text-sm text-muted">
          Every donor and partner has been touched in the last 60 days. Nice.
        </div>
        <ul v-else class="divide-y divide-default">
          <li
            v-for="c in data.atRiskClients"
            :key="c.id"
            class="flex items-center gap-3 py-3 text-sm"
          >
            <UIcon
              :name="c.type === 'donor' ? 'i-lucide-banknote' : 'i-lucide-handshake'"
              class="size-4 text-muted"
            />
            <NuxtLink :to="`/clients/${c.id}`" class="font-medium text-default hover:underline">{{
              c.name
            }}</NuxtLink>
            <UBadge
              variant="subtle"
              color="neutral"
              size="xs"
              :label="c.type === 'donor' ? 'Donor' : 'Partner'"
            />
            <span class="ml-auto text-xs text-muted">
              <template v-if="c.lastInteractionAt">
                Last touch {{ daysSince(c.lastInteractionAt) }} days ago
              </template>
              <template v-else>Never contacted</template>
            </span>
          </li>
        </ul>
      </UCard>
    </template>
  </div>
</template>
