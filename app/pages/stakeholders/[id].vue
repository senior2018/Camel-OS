<script setup lang="ts">
import {
  ENGAGEMENT_STRATEGIES,
  STAKEHOLDER_LEVELS,
  STAKEHOLDER_LEVEL_LABEL,
  STAKEHOLDER_TYPES,
  type StakeholderLevel,
} from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const canManage = computed(
  () => can.value('communications', 'update') || can.value('communications', 'approve')
)
const toast = useToast()

interface Activity {
  id: string
  activityDate: string
  type: string
  description: string | null
  outcome: string | null
  nextStep: string | null
  loggedByFirstName: string | null
  loggedByLastName: string | null
}
interface Stakeholder {
  id: string
  name: string
  type: string | null
  sector: string | null
  geography: string | null
  influence: StakeholderLevel
  interest: StakeholderLevel
  engagementStrategy: string | null
  ownerFirstName: string | null
  ownerLastName: string | null
}

const { data, refresh } = await useFetch<{ stakeholder: Stakeholder; activities: Activity[] }>(
  `/api/communications/stakeholders/${id}`,
  { key: `stakeholder-${id}` }
)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
useHead(() => ({ title: `${data.value?.stakeholder.name ?? 'Stakeholder'} — Camel OS` }))

const levelItems = STAKEHOLDER_LEVELS.map((l) => ({ label: STAKEHOLDER_LEVEL_LABEL[l], value: l }))
const typeItems = STAKEHOLDER_TYPES.map((t) => ({ label: t, value: t as string }))
const strategyItems = ENGAGEMENT_STRATEGIES.map((s) => ({ label: s, value: s as string }))

const form = reactive({
  type: '',
  sector: '',
  geography: '',
  influence: 'medium' as StakeholderLevel,
  interest: 'medium' as StakeholderLevel,
  engagementStrategy: '',
})
watchEffect(() => {
  const s = data.value?.stakeholder
  if (s) {
    form.type = s.type ?? ''
    form.sector = s.sector ?? ''
    form.geography = s.geography ?? ''
    form.influence = s.influence
    form.interest = s.interest
    form.engagementStrategy = s.engagementStrategy ?? ''
  }
})
const savingProfile = ref(false)
async function saveProfile() {
  savingProfile.value = true
  const endpoint: string = `/api/communications/stakeholders/${id}`
  try {
    await $fetch(endpoint, {
      method: 'PATCH',
      body: {
        type: form.type || null,
        sector: form.sector || null,
        geography: form.geography || null,
        influence: form.influence,
        interest: form.interest,
        engagementStrategy: form.engagementStrategy || null,
      },
    })
    toast.add({ title: 'Profile saved', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    savingProfile.value = false
  }
}

// ── Log activity ──
const logOpen = ref(false)
const logging = ref(false)
const act = reactive({
  activityDate: new Date().toISOString().slice(0, 10),
  type: 'Meeting',
  description: '',
  outcome: '',
  nextStep: '',
})
const activityTypes = ['Meeting', 'Call', 'Email', 'Event', 'Letter', 'Briefing'].map((t) => ({
  label: t,
  value: t,
}))
async function logActivity() {
  if (!act.type.trim()) return
  logging.value = true
  try {
    await $fetch(`/api/communications/stakeholders/${id}/activities`, {
      method: 'POST',
      body: {
        activityDate: act.activityDate,
        type: act.type,
        description: act.description || null,
        outcome: act.outcome || null,
        nextStep: act.nextStep || null,
      },
    })
    logOpen.value = false
    act.description = ''
    act.outcome = ''
    act.nextStep = ''
    await refresh()
  } catch {
    toast.add({ title: 'Could not log activity', color: 'error' })
  } finally {
    logging.value = false
  }
}

function ownerName() {
  const s = data.value?.stakeholder
  return [s?.ownerFirstName, s?.ownerLastName].filter(Boolean).join(' ') || '—'
}
function loggedBy(a: Activity) {
  return [a.loggedByFirstName, a.loggedByLastName].filter(Boolean).join(' ') || 'User'
}
function fdate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
          label="All stakeholders"
          class="-ml-2"
          @click="navigateTo('/stakeholders')"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight text-default">
            {{ data.stakeholder.name }}
          </h1>
          <UBadge
            v-if="data.stakeholder.type"
            color="neutral"
            variant="subtle"
            :label="data.stakeholder.type"
          />
        </div>
        <p class="mt-1 text-sm text-muted">Owner: {{ ownerName() }}</p>
      </div>
      <UButton
        v-if="canManage"
        icon="i-lucide-plus"
        label="Log engagement"
        @click="logOpen = true"
      />
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <!-- Activity timeline (CC-16) -->
      <div class="lg:col-span-2">
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Engagement history</h3></template
          >
          <div v-if="!data.activities.length" class="py-6 text-center text-sm text-muted">
            No engagement logged yet.
          </div>
          <ol v-else class="relative space-y-4 border-l border-default pl-4">
            <li v-for="a in data.activities" :key="a.id" class="relative">
              <span class="absolute -left-[1.36rem] top-1 size-2.5 rounded-full bg-primary" />
              <div class="flex items-center gap-2">
                <UBadge color="primary" variant="subtle" size="xs" :label="a.type" />
                <span class="text-xs text-muted"
                  >{{ fdate(a.activityDate) }} · {{ loggedBy(a) }}</span
                >
              </div>
              <p v-if="a.description" class="mt-1 text-sm text-default">{{ a.description }}</p>
              <p v-if="a.outcome" class="mt-0.5 text-xs text-muted">
                <strong>Outcome:</strong> {{ a.outcome }}
              </p>
              <p v-if="a.nextStep" class="mt-0.5 text-xs text-muted">
                <strong>Next:</strong> {{ a.nextStep }}
              </p>
            </li>
          </ol>
        </UCard>
      </div>

      <!-- Profile + strategy (CC-14/15) -->
      <div>
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Profile & strategy</h3></template
          >
          <div class="space-y-3">
            <UFormField label="Type">
              <USelect
                v-model="form.type"
                :items="typeItems"
                value-key="value"
                :disabled="!canManage"
                class="w-full"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Sector"
                ><UInput v-model="form.sector" :disabled="!canManage"
              /></UFormField>
              <UFormField label="Geography"
                ><UInput v-model="form.geography" :disabled="!canManage"
              /></UFormField>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Influence">
                <USelect
                  v-model="form.influence"
                  :items="levelItems"
                  value-key="value"
                  :disabled="!canManage"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Interest">
                <USelect
                  v-model="form.interest"
                  :items="levelItems"
                  value-key="value"
                  :disabled="!canManage"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField label="Engagement strategy">
              <USelect
                v-model="form.engagementStrategy"
                :items="strategyItems"
                value-key="value"
                :disabled="!canManage"
                class="w-full"
              />
            </UFormField>
            <div v-if="canManage" class="flex justify-end">
              <UButton
                size="sm"
                label="Save profile"
                :loading="savingProfile"
                @click="saveProfile"
              />
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <UModal v-model:open="logOpen" title="Log engagement">
      <template #body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Date"><UInput v-model="act.activityDate" type="date" /></UFormField>
            <UFormField label="Type"
              ><USelect v-model="act.type" :items="activityTypes" value-key="value" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Description"
            ><UTextarea v-model="act.description" :rows="2" class="w-full"
          /></UFormField>
          <UFormField label="Outcome"
            ><UTextarea v-model="act.outcome" :rows="2" class="w-full"
          /></UFormField>
          <UFormField label="Next step"><UInput v-model="act.nextStep" /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="logOpen = false" />
          <UButton label="Log activity" :loading="logging" @click="logActivity" />
        </div>
      </template>
    </UModal>
  </div>
</template>
