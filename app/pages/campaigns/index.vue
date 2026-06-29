<script setup lang="ts">
import {
  CAMPAIGN_STATUS_COLOR,
  CAMPAIGN_STATUS_LABEL,
  createCampaignSchema,
  type CampaignStatus,
} from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Campaigns — Camel OS' })

const { can } = await usePermissions()
const canManage = computed(
  () => can.value('communications', 'update') || can.value('communications', 'approve')
)
if (!canManage.value && !can.value('communications', 'create')) {
  throw createError({ statusCode: 403, statusMessage: 'No access to campaigns', fatal: true })
}

interface Campaign {
  id: string
  name: string
  objective: string | null
  status: CampaignStatus
  startDate: string | null
  endDate: string | null
  budgetPlanned: string | null
  currency: string
  ownerFirstName: string | null
  ownerLastName: string | null
  contentTotal: number
  contentPublished: number
}

const { data, status, refresh } = await useFetch<{ items: Campaign[] }>(
  '/api/communications/campaigns',
  { key: 'campaigns', default: () => ({ items: [] }) }
)

const toast = useToast()
const createOpen = ref(false)
const creating = ref(false)
const form = reactive({
  name: '',
  objective: '',
  audience: '',
  startDate: '',
  endDate: '',
  budgetPlanned: null as number | null,
  currency: 'USD',
})
async function create() {
  const parsed = createCampaignSchema.safeParse({
    name: form.name,
    objective: form.objective || null,
    audience: form.audience || null,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    budgetPlanned: form.budgetPlanned,
    currency: form.currency || 'USD',
  })
  if (!parsed.success) {
    toast.add({ title: 'A campaign name is required', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const res = await $fetch<{ campaign: { id: string } }>('/api/communications/campaigns', {
      method: 'POST',
      body: parsed.data,
    })
    createOpen.value = false
    await navigateTo(`/campaigns/${res.campaign.id}`)
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not create campaign', description: msg, color: 'error' })
  } finally {
    creating.value = false
  }
}

function ownerName(c: Campaign) {
  return [c.ownerFirstName, c.ownerLastName].filter(Boolean).join(' ') || '—'
}
function money(v: string | null, currency: string) {
  if (v == null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(v))
}
function range(c: Campaign) {
  const f = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'
  return `${f(c.startDate)} → ${f(c.endDate)}`
}
function pct(c: Campaign) {
  return c.contentTotal ? Math.round((c.contentPublished / c.contentTotal) * 100) : 0
}
void refresh
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Campaigns</h1>
        <p class="mt-1 text-sm text-muted">
          Plan outreach with an objective, audience, budget, and the content that delivers it.
        </p>
      </div>
      <UButton
        v-if="canManage"
        icon="i-lucide-plus"
        label="New campaign"
        @click="createOpen = true"
      />
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <div
      v-else-if="!data?.items.length"
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-megaphone" class="size-10 text-muted" />
      <h2 class="text-lg font-semibold text-default">No campaigns yet</h2>
      <p class="max-w-md text-sm text-muted">
        Create a campaign to group content around a shared objective and track its performance.
      </p>
      <UButton
        v-if="canManage"
        icon="i-lucide-plus"
        label="New campaign"
        @click="createOpen = true"
      />
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="c in data.items"
        :key="c.id"
        class="flex cursor-pointer flex-col rounded-xl border border-default bg-default p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow"
        @click="navigateTo(`/campaigns/${c.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <h2 class="font-semibold text-default">{{ c.name }}</h2>
          <UBadge
            :color="CAMPAIGN_STATUS_COLOR[c.status]"
            variant="subtle"
            size="xs"
            :label="CAMPAIGN_STATUS_LABEL[c.status]"
          />
        </div>
        <p v-if="c.objective" class="mt-1 line-clamp-2 text-sm text-muted">{{ c.objective }}</p>

        <div class="mt-3 space-y-2">
          <div class="flex items-center justify-between text-xs text-muted">
            <span>Content published</span>
            <span class="font-medium text-default"
              >{{ c.contentPublished }}/{{ c.contentTotal }}</span
            >
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${pct(c)}%` }" />
          </div>
        </div>

        <div
          class="mt-3 flex items-center justify-between border-t border-default pt-3 text-xs text-muted"
        >
          <span>{{ ownerName(c) }}</span>
          <span>{{ money(c.budgetPlanned, c.currency) }}</span>
        </div>
        <p class="mt-1 text-xs text-dimmed">{{ range(c) }}</p>
      </article>
    </div>

    <UModal v-model:open="createOpen" title="New campaign">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required>
            <UInput
              v-model="form.name"
              placeholder="e.g. Q3 Agriculture Thought-Leadership"
              autofocus
            />
          </UFormField>
          <UFormField label="Objective">
            <UTextarea
              v-model="form.objective"
              :rows="2"
              class="w-full"
              placeholder="What should this campaign achieve?"
            />
          </UFormField>
          <UFormField label="Target audience">
            <UInput v-model="form.audience" placeholder="e.g. Development partners, government" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Start">
              <UInput v-model="form.startDate" type="date" />
            </UFormField>
            <UFormField label="End">
              <UInput v-model="form.endDate" type="date" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Budget">
              <UInputNumber v-model="form.budgetPlanned" :min="0" placeholder="0" class="w-full" />
            </UFormField>
            <UFormField label="Currency">
              <UInput v-model="form.currency" maxlength="3" />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="createOpen = false" />
          <UButton label="Create campaign" :loading="creating" @click="create" />
        </div>
      </template>
    </UModal>
  </div>
</template>
