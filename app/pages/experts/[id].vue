<script setup lang="ts">
import {
  EXPERT_AVAILABILITIES,
  EXPERT_AVAILABILITY_COLOR,
  EXPERT_AVAILABILITY_LABEL,
  GOAL_STATUS_COLOR,
  GOAL_STATUS_LABEL,
  GOAL_STATUSES,
  LANGUAGE_PROFICIENCIES,
  expertProfileUpdateSchema,
  growthPlanSchema,
  type ExpertAvailability,
  type GoalStatus,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const { user } = useUserSession()
const isSelf = computed(() => (user.value as { id?: string } | null)?.id === id)
const canEdit = computed(() => can.value('hr', 'update') || isSelf.value)
const toast = useToast()

interface Profile {
  headline: string | null
  summary: string | null
  yearsExperience: number | null
  dailyRate: string | null
  currency: string
  availability: ExpertAvailability
  skills: string[]
  languages: { language: string; proficiency: string }[]
  sectors: string[]
  countries: string[]
  education: { institution: string; qualification: string; year?: string }[]
  experience: {
    role: string
    organization: string
    startYear?: string
    endYear?: string
    description?: string
  }[]
  assignmentHistory: { projectId?: string; projectName: string; role?: string }[]
  linkedinUrl: string | null
}
interface Cert {
  id: string
  name: string
  issuer: string | null
  expiryDate: string | null
}
interface Payload {
  user: { id: string; firstName: string | null; lastName: string | null; email: string }
  profile: Profile | null
  certifications: Cert[]
}
const { data, refresh } = await useFetch<Payload>(`/api/experts/${id}`, { key: `expert-${id}` })
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const fullName = computed(
  () =>
    [data.value?.user.firstName, data.value?.user.lastName].filter(Boolean).join(' ') ||
    data.value?.user.email
)
useHead(() => ({ title: `${fullName.value} — Expert` }))

const tab = ref<'cv' | 'growth'>('cv')
const p = computed(() => data.value?.profile)

// ── Profile edit ──
const editing = ref(false)
const form = reactive({
  headline: '',
  summary: '',
  yearsExperience: '',
  dailyRate: '',
  currency: 'USD',
  availability: 'available' as ExpertAvailability,
  skills: [] as string[],
  languages: [] as { language: string; proficiency: string }[],
  sectors: [] as string[],
  countries: [] as string[],
  education: [] as { institution: string; qualification: string; year?: string }[],
  experience: [] as {
    role: string
    organization: string
    startYear?: string
    endYear?: string
    description?: string
  }[],
  linkedinUrl: '',
})
function load() {
  const pr = data.value?.profile
  Object.assign(form, {
    headline: pr?.headline ?? '',
    summary: pr?.summary ?? '',
    yearsExperience: pr?.yearsExperience != null ? String(pr.yearsExperience) : '',
    dailyRate: pr?.dailyRate ?? '',
    currency: pr?.currency ?? 'USD',
    availability: pr?.availability ?? 'available',
    skills: [...(pr?.skills ?? [])],
    languages: (pr?.languages ?? []).map((l) => ({ ...l })),
    sectors: [...(pr?.sectors ?? [])],
    countries: [...(pr?.countries ?? [])],
    education: (pr?.education ?? []).map((e) => ({ ...e })),
    experience: (pr?.experience ?? []).map((e) => ({ ...e })),
    linkedinUrl: pr?.linkedinUrl ?? '',
  })
}
watchEffect(load)
function startEdit() {
  load()
  editing.value = true
}
function csvModel(key: 'skills' | 'sectors' | 'countries') {
  return computed({
    get: () => form[key].join(', '),
    set: (v: string) =>
      (form[key] = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)),
  })
}
const skillsCsv = csvModel('skills')
const sectorsCsv = csvModel('sectors')
const countriesCsv = csvModel('countries')
const availItems = EXPERT_AVAILABILITIES.map((a) => ({
  label: EXPERT_AVAILABILITY_LABEL[a],
  value: a as string,
}))
const profItems = LANGUAGE_PROFICIENCIES.map((pr) => ({ label: pr, value: pr as string }))

const saving = ref(false)
async function save() {
  const parsed = expertProfileUpdateSchema.safeParse({
    ...form,
    yearsExperience: form.yearsExperience === '' ? null : Number(form.yearsExperience),
    dailyRate: form.dailyRate === '' ? null : Number(form.dailyRate),
    linkedinUrl: form.linkedinUrl || '',
  })
  if (!parsed.success) {
    toast.add({ title: parsed.error.issues[0]?.message ?? 'Check the form', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const endpoint: string = `/api/experts/${id}`
    await $fetch(endpoint, { method: 'PUT', body: parsed.data })
    editing.value = false
    toast.add({ title: 'Expert profile saved', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    saving.value = false
  }
}
function rate(pr: Profile) {
  return pr.dailyRate
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: pr.currency,
        maximumFractionDigits: 0,
      }).format(Number(pr.dailyRate))
    : '—'
}

// ── EX-04 — download / print CV ──
async function downloadCv() {
  try {
    const res = await $fetch<{ name: string; html: string }>(`/api/experts/${id}/cv`)
    const w = window.open('', '_blank')
    if (!w) return
    const style =
      'body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#1f2937}h2{margin-bottom:0}h3{margin-top:1.5rem;border-bottom:1px solid #e5e7eb;padding-bottom:.25rem}ul{padding-left:1.1rem}'
    w.document.write(
      `<html><head><title>${res.name} — CV</title><style>${style}</style></head><body>${res.html}</body></html>`
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 200)
  } catch {
    toast.add({ title: 'Could not generate CV', color: 'error' })
  }
}

// ── EX-06 — growth plan ──
interface Goal {
  area: string
  objective: string
  actions?: string
  targetDate?: string
  status: GoalStatus
}
const { data: growth, refresh: refreshGrowth } = await useFetch<{
  plan: { periodLabel: string | null; reviewNotes: string | null; goals: Goal[] } | null
}>(`/api/hr/growth-plans/${id}`, { key: `growth-${id}`, default: () => ({ plan: null }) })
const gEditing = ref(false)
const gForm = reactive({ periodLabel: '', reviewNotes: '', goals: [] as Goal[] })
function loadGrowth() {
  gForm.periodLabel = growth.value?.plan?.periodLabel ?? ''
  gForm.reviewNotes = growth.value?.plan?.reviewNotes ?? ''
  gForm.goals = (growth.value?.plan?.goals ?? []).map((g) => ({ ...g }))
}
watchEffect(loadGrowth)
const goalStatusItems = GOAL_STATUSES.map((s) => ({
  label: GOAL_STATUS_LABEL[s],
  value: s as string,
}))
const gSaving = ref(false)
async function saveGrowth() {
  const parsed = growthPlanSchema.safeParse({
    periodLabel: gForm.periodLabel || null,
    reviewNotes: gForm.reviewNotes || null,
    goals: gForm.goals,
  })
  if (!parsed.success) {
    toast.add({ title: 'Each goal needs an area and objective', color: 'warning' })
    return
  }
  gSaving.value = true
  try {
    const endpoint: string = `/api/hr/growth-plans/${id}`
    await $fetch(endpoint, { method: 'PUT', body: parsed.data })
    gEditing.value = false
    toast.add({ title: 'Growth plan saved', color: 'success' })
    await refreshGrowth()
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    gSaving.value = false
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
          label="Expert Database"
          class="-ml-2"
          @click="navigateTo('/experts')"
        />
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-default">{{ fullName }}</h1>
        <p class="text-sm text-muted">{{ p?.headline ?? data.user.email }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UBadge
          v-if="p"
          :color="EXPERT_AVAILABILITY_COLOR[p.availability]"
          variant="subtle"
          :label="EXPERT_AVAILABILITY_LABEL[p.availability]"
        />
        <UButton
          v-if="p && tab === 'cv'"
          icon="i-lucide-download"
          variant="outline"
          color="neutral"
          label="CV"
          @click="downloadCv"
        />
        <UButton
          v-if="canEdit && tab === 'cv' && !editing"
          icon="i-lucide-pencil"
          variant="outline"
          color="neutral"
          :label="p ? 'Edit' : 'Create profile'"
          @click="startEdit"
        />
      </div>
    </div>

    <div class="flex gap-1 border-b border-default">
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium"
        :class="tab === 'cv' ? 'border-primary text-primary' : 'border-transparent text-muted'"
        @click="tab = 'cv'"
      >
        Profile & CV
      </button>
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium"
        :class="tab === 'growth' ? 'border-primary text-primary' : 'border-transparent text-muted'"
        @click="tab = 'growth'"
      >
        Growth plan
      </button>
    </div>

    <!-- ===== CV TAB ===== -->
    <template v-if="tab === 'cv'">
      <!-- VIEW -->
      <template v-if="!editing">
        <div
          v-if="!p"
          class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
        >
          No expert profile yet.
        </div>
        <template v-else>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-xl border border-default bg-default p-4">
              <p class="text-xs uppercase tracking-wide text-muted">Experience</p>
              <p class="mt-1 text-lg font-semibold text-default">
                {{ p.yearsExperience ?? '—'
                }}<span class="text-sm font-normal text-muted"> yrs</span>
              </p>
            </div>
            <div class="rounded-xl border border-default bg-default p-4">
              <p class="text-xs uppercase tracking-wide text-muted">Day rate</p>
              <p class="mt-1 text-lg font-semibold text-default">{{ rate(p) }}</p>
            </div>
            <div class="rounded-xl border border-default bg-default p-4">
              <p class="text-xs uppercase tracking-wide text-muted">Languages</p>
              <p class="mt-1 text-sm font-medium text-default">
                {{ p.languages.map((l) => l.language).join(', ') || '—' }}
              </p>
            </div>
            <div class="rounded-xl border border-default bg-default p-4">
              <p class="text-xs uppercase tracking-wide text-muted">Countries</p>
              <p class="mt-1 text-sm font-medium text-default">
                {{ p.countries.join(', ') || '—' }}
              </p>
            </div>
          </div>

          <UCard v-if="p.summary"
            ><template #header
              ><h3 class="text-sm font-semibold text-default">Professional summary</h3></template
            >
            <p class="whitespace-pre-line text-sm text-muted">{{ p.summary }}</p></UCard
          >

          <UCard v-if="p.skills.length || p.sectors.length">
            <template #header
              ><h3 class="text-sm font-semibold text-default">Skills & sectors</h3></template
            >
            <div class="space-y-2">
              <div class="flex flex-wrap gap-1.5">
                <UBadge
                  v-for="s in p.skills"
                  :key="s"
                  color="primary"
                  variant="subtle"
                  size="sm"
                  :label="s"
                />
              </div>
              <div class="flex flex-wrap gap-1.5">
                <UBadge
                  v-for="s in p.sectors"
                  :key="s"
                  color="info"
                  variant="subtle"
                  size="sm"
                  :label="s"
                />
              </div>
            </div>
          </UCard>

          <UCard v-if="p.experience.length">
            <template #header
              ><h3 class="text-sm font-semibold text-default">Experience</h3></template
            >
            <ol class="space-y-3">
              <li v-for="(x, i) in p.experience" :key="i" class="border-l-2 border-primary/30 pl-3">
                <p class="text-sm font-medium text-default">{{ x.role }} · {{ x.organization }}</p>
                <p class="text-xs text-muted">
                  {{ [x.startYear, x.endYear].filter(Boolean).join(' – ') }}
                </p>
                <p v-if="x.description" class="mt-0.5 text-sm text-muted">{{ x.description }}</p>
              </li>
            </ol>
          </UCard>

          <UCard v-if="p.education.length">
            <template #header
              ><h3 class="text-sm font-semibold text-default">Education</h3></template
            >
            <ul class="space-y-1.5">
              <li v-for="(e, i) in p.education" :key="i" class="text-sm text-default">
                {{ e.qualification }}, {{ e.institution
                }}<span v-if="e.year" class="text-muted"> ({{ e.year }})</span>
              </li>
            </ul>
          </UCard>

          <UCard v-if="p.assignmentHistory.length">
            <template #header
              ><h3 class="text-sm font-semibold text-default">Assignment history</h3></template
            >
            <ul class="space-y-1.5">
              <li v-for="(a, i) in p.assignmentHistory" :key="i" class="text-sm text-default">
                <NuxtLink
                  v-if="a.projectId"
                  :to="`/projects/${a.projectId}`"
                  class="text-primary hover:underline"
                  >{{ a.projectName }}</NuxtLink
                >
                <span v-else>{{ a.projectName }}</span>
                <span v-if="a.role" class="text-muted"> — {{ a.role }}</span>
              </li>
            </ul>
          </UCard>

          <UCard v-if="data.certifications.length">
            <template #header
              ><h3 class="text-sm font-semibold text-default">Certifications</h3></template
            >
            <ul class="space-y-1.5">
              <li v-for="c in data.certifications" :key="c.id" class="text-sm text-default">
                {{ c.name }}<span v-if="c.issuer" class="text-muted"> — {{ c.issuer }}</span>
              </li>
            </ul>
          </UCard>
        </template>
      </template>

      <!-- EDIT -->
      <template v-else>
        <UCard>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Headline" class="sm:col-span-2"
              ><UInput v-model="form.headline" placeholder="e.g. Senior M&E Specialist"
            /></UFormField>
            <UFormField label="Years of experience"
              ><UInput v-model="form.yearsExperience" type="number"
            /></UFormField>
            <UFormField label="Availability"
              ><USelect
                v-model="form.availability"
                :items="availItems"
                value-key="value"
                class="w-full"
            /></UFormField>
            <UFormField label="Day rate"
              ><UInput v-model="form.dailyRate" type="number"
            /></UFormField>
            <UFormField label="Currency"
              ><UInput v-model="form.currency" maxlength="3"
            /></UFormField>
            <UFormField label="Summary" class="sm:col-span-2"
              ><UTextarea v-model="form.summary" :rows="3" class="w-full"
            /></UFormField>
            <UFormField label="Skills" hint="comma-separated" class="sm:col-span-2"
              ><UInput v-model="skillsCsv" placeholder="Evaluation, Survey design, STATA"
            /></UFormField>
            <UFormField label="Sectors" hint="comma-separated"
              ><UInput v-model="sectorsCsv" placeholder="Health, Education"
            /></UFormField>
            <UFormField label="Countries" hint="comma-separated"
              ><UInput v-model="countriesCsv" placeholder="Kenya, Tanzania"
            /></UFormField>
            <UFormField label="LinkedIn URL" class="sm:col-span-2"
              ><UInput v-model="form.linkedinUrl" placeholder="https://…"
            /></UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header
            ><div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Languages</h3>
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add"
                @click="form.languages.push({ language: '', proficiency: 'professional' })"
              /></div
          ></template>
          <div class="space-y-2">
            <div v-for="(l, i) in form.languages" :key="i" class="flex items-center gap-2">
              <UInput v-model="l.language" placeholder="Language" class="flex-1" />
              <USelect v-model="l.proficiency" :items="profItems" value-key="value" class="w-44" />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                aria-label="Remove"
                @click="form.languages.splice(i, 1)"
              />
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header
            ><div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Experience</h3>
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add"
                @click="form.experience.push({ role: '', organization: '' })"
              /></div
          ></template>
          <div class="space-y-3">
            <div
              v-for="(x, i) in form.experience"
              :key="i"
              class="space-y-2 rounded-lg border border-default p-2"
            >
              <div class="flex gap-2">
                <UInput v-model="x.role" placeholder="Role" class="flex-1" /><UInput
                  v-model="x.organization"
                  placeholder="Organization"
                  class="flex-1"
                /><UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-x"
                  aria-label="Remove"
                  @click="form.experience.splice(i, 1)"
                />
              </div>
              <div class="flex gap-2">
                <UInput v-model="x.startYear" placeholder="From (year)" class="w-32" /><UInput
                  v-model="x.endYear"
                  placeholder="To (year)"
                  class="w-32"
                />
              </div>
              <UTextarea
                v-model="x.description"
                :rows="2"
                class="w-full"
                placeholder="What you did"
              />
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header
            ><div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Education</h3>
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add"
                @click="form.education.push({ institution: '', qualification: '' })"
              /></div
          ></template>
          <div class="space-y-2">
            <div v-for="(e, i) in form.education" :key="i" class="flex gap-2">
              <UInput v-model="e.qualification" placeholder="Qualification" class="flex-1" />
              <UInput v-model="e.institution" placeholder="Institution" class="flex-1" />
              <UInput v-model="e.year" placeholder="Year" class="w-24" />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                aria-label="Remove"
                @click="form.education.splice(i, 1)"
              />
            </div>
          </div>
        </UCard>

        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="editing = false"
          /><UButton label="Save profile" :loading="saving" @click="save" />
        </div>
      </template>
    </template>

    <!-- ===== GROWTH PLAN TAB ===== -->
    <template v-else>
      <div class="flex justify-end">
        <UButton
          v-if="canEdit && !gEditing"
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-lucide-pencil"
          :label="growth?.plan ? 'Edit plan' : 'Create plan'"
          @click="gEditing = true"
        />
      </div>

      <template v-if="!gEditing">
        <div
          v-if="!growth?.plan"
          class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
        >
          No growth plan yet.
        </div>
        <template v-else>
          <p v-if="growth.plan.periodLabel" class="text-sm text-muted">
            Period: <span class="font-medium text-default">{{ growth.plan.periodLabel }}</span>
          </p>
          <UCard v-for="(g, i) in growth.plan.goals" :key="i">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">{{ g.area }}</p>
                <p class="font-medium text-default">{{ g.objective }}</p>
                <p v-if="g.actions" class="mt-1 text-sm text-muted">{{ g.actions }}</p>
                <p v-if="g.targetDate" class="mt-1 text-xs text-dimmed">
                  Target: {{ g.targetDate }}
                </p>
              </div>
              <UBadge
                :color="GOAL_STATUS_COLOR[g.status]"
                variant="subtle"
                size="xs"
                :label="GOAL_STATUS_LABEL[g.status]"
              />
            </div>
          </UCard>
          <UCard v-if="growth.plan.reviewNotes"
            ><template #header
              ><h3 class="text-sm font-semibold text-default">Review notes</h3></template
            >
            <p class="whitespace-pre-line text-sm text-muted">
              {{ growth.plan.reviewNotes }}
            </p></UCard
          >
        </template>
      </template>

      <template v-else>
        <UCard>
          <div class="space-y-3">
            <UFormField label="Period"
              ><UInput v-model="gForm.periodLabel" placeholder="e.g. 2026 H2"
            /></UFormField>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Goals</h3>
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add goal"
                @click="
                  gForm.goals.push({
                    area: '',
                    objective: '',
                    actions: '',
                    targetDate: '',
                    status: 'not_started',
                  })
                "
              />
            </div>
            <div
              v-for="(g, i) in gForm.goals"
              :key="i"
              class="space-y-2 rounded-lg border border-default p-2"
            >
              <div class="flex gap-2">
                <UInput
                  v-model="g.area"
                  placeholder="Area (e.g. Leadership)"
                  class="flex-1"
                /><USelect
                  v-model="g.status"
                  :items="goalStatusItems"
                  value-key="value"
                  class="w-40"
                /><UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-x"
                  aria-label="Remove"
                  @click="gForm.goals.splice(i, 1)"
                />
              </div>
              <UInput v-model="g.objective" placeholder="Objective" />
              <UTextarea
                v-model="g.actions"
                :rows="2"
                class="w-full"
                placeholder="Actions / support needed"
              />
              <UInput v-model="g.targetDate" type="date" />
            </div>
            <UFormField label="Review notes"
              ><UTextarea v-model="gForm.reviewNotes" :rows="3" class="w-full"
            /></UFormField>
          </div>
        </UCard>
        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="gEditing = false"
          /><UButton label="Save plan" :loading="gSaving" @click="saveGrowth" />
        </div>
      </template>
    </template>
  </div>
</template>
