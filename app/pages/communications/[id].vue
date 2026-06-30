<script setup lang="ts">
import {
  CONTENT_STATUS_COLOR,
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_LABEL,
  CONTENT_TYPES,
  type BadgeColor,
  type ContentReviewDecision,
  type ContentStatus,
} from '@@/shared/schemas/communication'
// Explicit imports: these live in components/communication/ but are named
// Content* (no dir-prefix match), so Nuxt auto-import registers them as
// CommunicationContent* — the short <ContentEditor> refs below won't resolve
// without importing them here.
import ContentEditor from '~/components/communication/ContentEditor.vue'
import ContentComments from '~/components/communication/ContentComments.vue'
import ContentMetricsCard from '~/components/communication/ContentMetricsCard.vue'
import ContentReviewModal from '~/components/communication/ContentReviewModal.vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
if (
  !(
    can.value('communications', 'create') ||
    can.value('communications', 'update') ||
    can.value('communications', 'approve')
  )
) {
  throw createError({
    statusCode: 403,
    statusMessage: 'The Communications workspace is for the content team.',
    fatal: true,
  })
}
const { user } = useUserSession()
const myId = computed(() => (user.value as { id?: string } | null)?.id ?? '')
const toast = useToast()

interface Review {
  id: string
  reviewerUserId: string
  reviewerFirstName: string | null
  reviewerLastName: string | null
  stepOrder: number
  decision: ContentReviewDecision
  comment: string | null
  decidedAt: string | null
}
interface Content {
  id: string
  title: string
  type: string
  category: string | null
  excerpt: string | null
  body: string | null
  coverImageUrl: string | null
  tags: string[]
  status: ContentStatus
  authorUserId: string | null
  authorFirstName: string | null
  authorLastName: string | null
  scheduledFor: string | null
  campaignId: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

const { data, refresh } = await useFetch<{ content: Content; reviews: Review[] }>(
  `/api/communications/content/${id}`,
  { key: `content-${id}` }
)
if (!data.value)
  throw createError({ statusCode: 404, statusMessage: 'Content not found', fatal: true })

useHead(() => ({ title: `${data.value?.content.title ?? 'Content'} — Camel OS` }))

const cStatus = computed(() => data.value?.content.status ?? 'draft')
const canWrite = computed(
  () =>
    can.value('communications', 'update') && ['draft', 'changes_requested'].includes(cStatus.value)
)
const canApprove = computed(() => can.value('communications', 'approve'))
const myReview = computed(() => data.value?.reviews.find((r) => r.reviewerUserId === myId.value))
const isPendingReviewer = computed(
  () => cStatus.value === 'in_review' && myReview.value?.decision === 'pending'
)

// ── Editable metadata ──
const meta = reactive({
  title: '',
  type: 'insight',
  category: '',
  excerpt: '',
  tags: [] as string[],
  scheduleDate: '',
  campaignId: '',
})
watchEffect(() => {
  const c = data.value?.content
  if (c) {
    meta.title = c.title
    meta.type = c.type
    meta.category = c.category ?? ''
    meta.excerpt = c.excerpt ?? ''
    meta.tags = [...c.tags]
    meta.scheduleDate = c.scheduledFor ? c.scheduledFor.slice(0, 10) : ''
    meta.campaignId = c.campaignId ?? ''
  }
})

// Campaign options for the link picker (CC-10).
const { data: campaignData } = useFetch<{ items: { id: string; name: string }[] }>(
  '/api/communications/campaigns',
  { key: 'campaigns-mini', default: () => ({ items: [] }) }
)
const campaignItems = computed(() => [
  { label: 'No campaign', value: '' },
  ...(campaignData.value?.items ?? []).map((c) => ({ label: c.name, value: c.id })),
])

const tagInput = ref('')
function addTag() {
  const t = tagInput.value.trim()
  if (t && !meta.tags.includes(t)) meta.tags.push(t)
  tagInput.value = ''
}
const savingMeta = ref(false)
async function saveMeta() {
  savingMeta.value = true
  try {
    await $fetch(`/api/communications/content/${id}`, {
      method: 'PATCH',
      body: {
        title: meta.title,
        type: meta.type,
        category: meta.category || null,
        excerpt: meta.excerpt || null,
        tags: meta.tags,
        scheduledFor: meta.scheduleDate ? `${meta.scheduleDate}T09:00:00.000Z` : null,
        campaignId: meta.campaignId || null,
      },
    })
    toast.add({ title: 'Details saved', color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    savingMeta.value = false
  }
}

// ── Send for review ──
const reviewModalOpen = ref(false)
const sendOpen = ref(false)
interface ReviewerOption {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}
const reviewers = ref<ReviewerOption[]>([])
const picked = ref<string[]>([])
const loadingReviewers = ref(false)
const sending = ref(false)
async function openSend() {
  sendOpen.value = true
  loadingReviewers.value = true
  try {
    const res = await $fetch<{ reviewers: ReviewerOption[] }>('/api/communications/reviewers')
    reviewers.value = res.reviewers
  } finally {
    loadingReviewers.value = false
  }
}
const reviewerItems = computed(() =>
  reviewers.value.map((r) => ({
    label: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email,
    value: r.id,
  }))
)
async function sendForReview() {
  if (!picked.value.length) {
    toast.add({ title: 'Pick at least one reviewer', color: 'warning' })
    return
  }
  sending.value = true
  try {
    await $fetch(`/api/communications/content/${id}/send-for-review`, {
      method: 'POST',
      body: { reviewers: picked.value.map((userId) => ({ userId, stepOrder: 1 })) },
    })
    toast.add({ title: 'Sent for review', color: 'success' })
    sendOpen.value = false
    picked.value = []
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not send', description: msg, color: 'error' })
  } finally {
    sending.value = false
  }
}

// ── Recall / Publish ──
const acting = ref(false)
async function act(path: string, ok: string) {
  acting.value = true
  try {
    await $fetch(`/api/communications/content/${id}/${path}`, { method: 'POST' })
    toast.add({ title: ok, color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Action failed', description: msg, color: 'error' })
  } finally {
    acting.value = false
  }
}

const typeItems = CONTENT_TYPES.map((t) => ({ label: CONTENT_TYPE_LABEL[t], value: t as string }))
function rname(r: Review) {
  return [r.reviewerFirstName, r.reviewerLastName].filter(Boolean).join(' ') || 'Reviewer'
}
function authorName() {
  const c = data.value?.content
  return [c?.authorFirstName, c?.authorLastName].filter(Boolean).join(' ') || '—'
}
function fmt(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'
}
const reviewColor: Record<ContentReviewDecision, BadgeColor> = {
  pending: 'neutral',
  approved: 'success',
  changes_requested: 'warning',
  rejected: 'error',
}
const approvedCount = computed(
  () => data.value?.reviews.filter((r) => r.decision === 'approved').length ?? 0
)
</script>

<template>
  <div v-if="data" class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="All content"
          class="-ml-2"
          @click="navigateTo('/communications')"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight text-default">
            {{ data.content.title }}
          </h1>
          <UBadge
            :color="CONTENT_STATUS_COLOR[data.content.status]"
            variant="subtle"
            :label="CONTENT_STATUS_LABEL[data.content.status]"
          />
          <UBadge
            color="neutral"
            variant="outline"
            :label="
              CONTENT_TYPE_LABEL[data.content.type as keyof typeof CONTENT_TYPE_LABEL] ??
              data.content.type
            "
          />
        </div>
      </div>

      <!-- Contextual primary action -->
      <div class="flex items-center gap-2">
        <UButton
          v-if="['draft', 'changes_requested'].includes(cStatus) && can('communications', 'update')"
          icon="i-lucide-send"
          label="Send for review"
          @click="openSend"
        />
        <UButton
          v-if="isPendingReviewer"
          icon="i-lucide-clipboard-check"
          color="primary"
          label="Review"
          @click="reviewModalOpen = true"
        />
        <UButton
          v-if="cStatus === 'approved' && canApprove"
          icon="i-lucide-globe"
          color="success"
          label="Publish"
          :loading="acting"
          @click="act('publish', 'Published to the library')"
        />
        <UButton
          v-if="['in_review', 'approved'].includes(cStatus) && can('communications', 'update')"
          icon="i-lucide-undo-2"
          variant="outline"
          color="neutral"
          label="Recall"
          :loading="acting"
          @click="act('recall', 'Recalled to draft')"
        />
        <UButton
          v-if="cStatus === 'published'"
          icon="i-lucide-library"
          variant="outline"
          color="neutral"
          label="View in library"
          @click="navigateTo('/library')"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <!-- Editor + discussion -->
      <div class="space-y-4 lg:col-span-2">
        <ContentEditor
          :content-id="id"
          :content="data.content.body"
          :editable="canWrite"
          @saved="refresh"
        />
        <p v-if="!canWrite" class="text-xs text-muted">
          Read-only — content can only be edited while in Draft or after changes are requested.
        </p>
        <ContentComments
          :content-id="id"
          :can-post="can('communications', 'update') || can('communications', 'approve')"
        />
      </div>

      <!-- Sidebar -->
      <div class="space-y-4">
        <!-- Approval workflow -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Approval</h3>
              <UBadge
                v-if="data.reviews.length"
                variant="subtle"
                size="xs"
                :color="approvedCount === data.reviews.length ? 'success' : 'neutral'"
                :label="`${approvedCount}/${data.reviews.length} approved`"
              />
            </div>
          </template>
          <div v-if="!data.reviews.length" class="text-sm text-muted">
            No reviewers yet. Use <strong>Send for review</strong> to assign named reviewers.
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="r in data.reviews"
              :key="r.id"
              class="flex items-center justify-between gap-2"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">{{ rname(r) }}</p>
                <p v-if="r.comment" class="truncate text-xs text-muted">{{ r.comment }}</p>
              </div>
              <UBadge
                :color="reviewColor[r.decision]"
                variant="subtle"
                size="xs"
                :label="r.decision"
              />
            </li>
          </ul>
        </UCard>

        <!-- Details -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold text-default">Details</h3>
          </template>
          <div class="space-y-3">
            <UFormField label="Title">
              <UInput v-model="meta.title" :disabled="!canWrite" />
            </UFormField>
            <UFormField label="Type">
              <USelect
                v-model="meta.type"
                :items="typeItems"
                value-key="value"
                :disabled="!canWrite"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Category">
              <UInput
                v-model="meta.category"
                placeholder="e.g. Agriculture"
                :disabled="!canWrite"
              />
            </UFormField>
            <UFormField label="Excerpt" hint="Shown in the library">
              <UTextarea v-model="meta.excerpt" :rows="2" :disabled="!canWrite" class="w-full" />
            </UFormField>
            <UFormField label="Tags">
              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="(t, i) in meta.tags"
                  :key="t"
                  variant="subtle"
                  color="neutral"
                  size="xs"
                  class="cursor-pointer"
                  @click="canWrite && meta.tags.splice(i, 1)"
                >
                  {{ t }}
                </UBadge>
              </div>
              <UInput
                v-if="canWrite"
                v-model="tagInput"
                placeholder="Add tag + Enter"
                size="sm"
                class="mt-1"
                @keydown.enter.prevent="addTag"
              />
            </UFormField>
            <UFormField label="Schedule" hint="Planned publish date (calendar)">
              <UInput
                v-model="meta.scheduleDate"
                type="date"
                :disabled="!canWrite"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Campaign">
              <USelect
                v-model="meta.campaignId"
                :items="campaignItems"
                value-key="value"
                :disabled="!canWrite"
                class="w-full"
              />
            </UFormField>
            <div v-if="canWrite" class="flex justify-end">
              <UButton size="sm" label="Save details" :loading="savingMeta" @click="saveMeta" />
            </div>
          </div>
        </UCard>

        <!-- Engagement metrics (CC-08) — relevant once published -->
        <ContentMetricsCard
          v-if="data.content.status === 'published'"
          :content-id="id"
          :can-edit="can('communications', 'update')"
        />

        <!-- About -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold text-default">About</h3>
          </template>
          <dl class="space-y-1.5 text-sm">
            <div class="flex justify-between gap-2">
              <dt class="text-muted">Author</dt>
              <dd class="text-default">{{ authorName() }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted">Created</dt>
              <dd class="text-default">{{ fmt(data.content.createdAt) }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted">Updated</dt>
              <dd class="text-default">{{ fmt(data.content.updatedAt) }}</dd>
            </div>
            <div v-if="data.content.publishedAt" class="flex justify-between gap-2">
              <dt class="text-muted">Published</dt>
              <dd class="text-default">{{ fmt(data.content.publishedAt) }}</dd>
            </div>
          </dl>
        </UCard>
      </div>
    </div>

    <!-- Send-for-review modal -->
    <UModal v-model:open="sendOpen" title="Send for review">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-muted">
            Choose the named reviewers who must sign off. They'll be notified by email and in-app.
          </p>
          <div v-if="loadingReviewers" class="flex justify-center py-4">
            <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
          </div>
          <USelectMenu
            v-else
            v-model="picked"
            :items="reviewerItems"
            value-key="value"
            multiple
            placeholder="Select reviewers…"
            class="w-full"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="sendOpen = false" />
          <UButton label="Send for review" :loading="sending" @click="sendForReview" />
        </div>
      </template>
    </UModal>

    <ContentReviewModal v-model:open="reviewModalOpen" :content-id="id" @decided="refresh" />
  </div>
</template>
