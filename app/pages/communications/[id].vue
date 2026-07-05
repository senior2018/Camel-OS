<script setup lang="ts">
import {
  CONTENT_STATUS_COLOR,
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_LABEL,
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
  coverImageUrl: '',
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
    meta.coverImageUrl = c.coverImageUrl ?? ''
    meta.tags = [...c.tags]
    meta.scheduleDate = c.scheduledFor ? c.scheduledFor.slice(0, 10) : ''
    meta.campaignId = c.campaignId ?? NO_CAMPAIGN
  }
})

// Campaign options for the link picker (CC-10). Nuxt UI v4 forbids an
// empty-string option value, so "No campaign" uses a sentinel mapped to null.
const NO_CAMPAIGN = '__none__'
const { data: campaignData } = useFetch<{ items: { id: string; name: string }[] }>(
  '/api/communications/campaigns',
  { key: 'campaigns-mini', default: () => ({ items: [] }) }
)
const campaignItems = computed(() => [
  { label: 'No campaign', value: NO_CAMPAIGN },
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
        coverImageUrl: meta.coverImageUrl.trim() || null,
        tags: meta.tags,
        scheduledFor: meta.scheduleDate ? `${meta.scheduleDate}T09:00:00.000Z` : null,
        campaignId: meta.campaignId === NO_CAMPAIGN ? null : meta.campaignId || null,
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
// The org review policy sets the minimum number of reviewers and whether the
// Communications Lead must give the final approval (publish).
const { data: policyData } = useFetch<{
  policy: { reviewMinReviewers: number; requireFinalApprover: boolean }
}>('/api/communications/settings/review-policy', {
  key: 'comms-review-policy',
  default: () => ({ policy: { reviewMinReviewers: 1, requireFinalApprover: true } }),
})
const minReviewers = computed(() => policyData.value?.policy?.reviewMinReviewers ?? 1)
const enoughReviewers = computed(() => picked.value.length >= minReviewers.value)
// Publishing is the final sign-off. When the policy requires a final approver,
// only the Communications Lead (communications:admin) or an org admin may do it.
const isCommsLead = computed(
  () => can.value('communications', 'admin') || can.value('admin', 'admin')
)
const canPublish = computed(
  () =>
    can.value('communications', 'approve') &&
    (!(policyData.value?.policy?.requireFinalApprover ?? true) || isCommsLead.value)
)
async function sendForReview() {
  if (!enoughReviewers.value) {
    toast.add({
      title: `Pick at least ${minReviewers.value} reviewer${minReviewers.value === 1 ? '' : 's'}`,
      color: 'warning',
    })
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

// Content types + categories come from settings (defaults + org-defined values).
const { data: optionsData } = await useFetch<{
  types: { key: string; label: string }[]
  categories: { key: string; label: string }[]
}>('/api/communications/settings/options', {
  key: 'comms-options',
  default: () => ({ types: [], categories: [] }),
})
const typeItems = computed(() =>
  (optionsData.value?.types ?? []).map((t) => ({ label: t.label, value: t.key }))
)
// A leader-managed category list, but authors may still type a fresh one.
const categoryItems = computed(() => (optionsData.value?.categories ?? []).map((c) => c.label))
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
// Tabbed working surface (mirrors the proposal page): the document, its details,
// the approval roster, and metadata — with the Conversation living in the right
// rail alongside.
const workspaceTabs = [
  { label: 'Document', icon: 'i-lucide-file-text', slot: 'document' as const },
  { label: 'Details', icon: 'i-lucide-info', slot: 'details' as const },
  { label: 'About', icon: 'i-lucide-clock', slot: 'about' as const },
]
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
          v-if="cStatus === 'approved' && canPublish"
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
      <!-- Left: tabbed working surface (mirrors the proposal page). -->
      <div class="lg:col-span-2">
        <UTabs :items="workspaceTabs" :unmount-on-hide="false" variant="link" class="w-full gap-4">
          <template #document>
            <!-- Bound the editor to the viewport so the document scrolls
                 internally instead of stretching the page. -->
            <div class="flex flex-col gap-3 lg:h-[calc(100dvh-11rem)]">
              <ContentEditor
                :content-id="id"
                :content="data.content.body"
                :editable="canWrite"
                class="min-h-0 flex-1"
                @saved="refresh"
              />
              <p v-if="!canWrite" class="shrink-0 text-xs text-muted">
                Read-only — content can only be edited while in Draft or after changes are
                requested.
              </p>
            </div>
          </template>

          <!-- Details -->
          <template #details>
            <UCard>
              <template #header>
                <h3 class="text-sm font-semibold text-default">Details</h3>
              </template>
              <!-- EDIT MODE — editable fields, only for the writing team while the
               item is still editable. -->
              <div v-if="canWrite" class="space-y-3">
                <UFormField label="Title">
                  <UInput v-model="meta.title" />
                </UFormField>
                <UFormField label="Type">
                  <USelect
                    v-model="meta.type"
                    :items="typeItems"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Category" hint="Managed in Communications settings">
                  <UInput v-model="meta.category" placeholder="e.g. Agriculture" class="w-full" />
                  <div v-if="categoryItems.length" class="mt-1.5 flex flex-wrap gap-1">
                    <UBadge
                      v-for="c in categoryItems"
                      :key="c"
                      variant="subtle"
                      :color="meta.category === c ? 'primary' : 'neutral'"
                      size="xs"
                      class="cursor-pointer"
                      @click="meta.category = c"
                    >
                      {{ c }}
                    </UBadge>
                  </div>
                </UFormField>
                <UFormField label="Excerpt" hint="Shown in the library">
                  <UTextarea v-model="meta.excerpt" :rows="2" class="w-full" />
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
                      @click="meta.tags.splice(i, 1)"
                    >
                      {{ t }}
                    </UBadge>
                  </div>
                  <UInput
                    v-model="tagInput"
                    placeholder="Add tag + Enter"
                    size="sm"
                    class="mt-1"
                    @keydown.enter.prevent="addTag"
                  />
                </UFormField>
                <UFormField label="Schedule" hint="Planned publish date (calendar)">
                  <UInput v-model="meta.scheduleDate" type="date" class="w-full" />
                </UFormField>
                <UFormField label="Campaign">
                  <USelect
                    v-model="meta.campaignId"
                    :items="campaignItems"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Cover image"
                  hint="Shown on the library card and article banner. Leave blank to use the first image in the article."
                >
                  <UInput
                    v-model="meta.coverImageUrl"
                    type="url"
                    placeholder="https://…/photo.jpg"
                    icon="i-lucide-image"
                    class="w-full"
                  />
                  <div
                    v-if="meta.coverImageUrl.trim()"
                    class="mt-2 aspect-[21/9] overflow-hidden rounded-lg bg-cover bg-center ring-1 ring-default"
                    :style="{ backgroundImage: `url(${meta.coverImageUrl})` }"
                  />
                </UFormField>
                <div class="flex justify-end">
                  <UButton size="sm" label="Save details" :loading="savingMeta" @click="saveMeta" />
                </div>
              </div>

              <!-- READ MODE — a clean, smooth reading view: plain values, no input
               borders, no disabled/"locked" fields. -->
              <div v-else class="space-y-3 text-sm">
                <!-- Cover preview so a reviewer can see what will front the
                     library card + article. -->
                <div
                  v-if="meta.coverImageUrl.trim()"
                  class="aspect-[21/9] overflow-hidden rounded-lg bg-cover bg-center ring-1 ring-default"
                  :style="{ backgroundImage: `url(${meta.coverImageUrl})` }"
                />
                <!-- Type + category as chips, then a clean reading layout (matches
                 the opportunity read view). -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <UBadge
                    variant="subtle"
                    color="info"
                    size="sm"
                    :label="typeItems.find((t) => t.value === meta.type)?.label ?? meta.type"
                  />
                  <UBadge
                    v-if="meta.category"
                    variant="subtle"
                    color="neutral"
                    size="sm"
                    :label="meta.category"
                  />
                </div>
                <p v-if="meta.excerpt" class="whitespace-pre-wrap leading-relaxed text-toned">
                  {{ meta.excerpt }}
                </p>
                <div v-if="meta.tags.length" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="t in meta.tags"
                    :key="t"
                    variant="subtle"
                    color="primary"
                    size="xs"
                    :label="t"
                  />
                </div>
                <div
                  v-if="meta.scheduleDate"
                  class="flex justify-between gap-2 border-t border-default pt-2"
                >
                  <span class="text-muted">Scheduled</span>
                  <span class="font-medium text-default">{{ meta.scheduleDate }}</span>
                </div>
                <div
                  v-if="meta.campaignId && meta.campaignId !== NO_CAMPAIGN"
                  class="flex justify-between gap-2"
                >
                  <span class="text-muted">Campaign</span>
                  <span class="font-medium text-default">
                    {{ campaignItems.find((c) => c.value === meta.campaignId)?.label ?? '—' }}
                  </span>
                </div>
              </div>
            </UCard>
          </template>

          <!-- About -->
          <template #about>
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
          </template>
        </UTabs>
      </div>

      <!-- Right rail — Conversation + engagement metrics, mirroring the proposal:
           it sticks and fills the viewport height, scrolling internally, so there
           is no dead space beside the document. -->
      <div
        class="flex flex-col gap-4 lg:sticky lg:top-6 lg:col-span-1 lg:h-[calc(100dvh-7rem)] lg:self-start"
      >
        <ContentComments
          :content-id="id"
          :can-post="can('communications', 'update') || can('communications', 'approve')"
          class="flex min-h-0 flex-1 flex-col"
        />
        <ContentMetricsCard
          v-if="data.content.status === 'published'"
          :content-id="id"
          :can-edit="can('communications', 'update')"
          class="shrink-0"
        />
      </div>
    </div>

    <!-- Send-for-review modal -->
    <UModal v-model:open="sendOpen" title="Send for review">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-muted">
            Choose the named reviewers who read, comment, and sign off. They'll be notified by email
            and in-app.
          </p>
          <p class="text-xs text-muted">
            This organization requires at least
            <span class="font-semibold text-default">{{ minReviewers }}</span>
            reviewer{{ minReviewers === 1 ? '' : 's' }}. The Communications Lead gives the final
            approval before publishing.
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
          <p v-if="picked.length && !enoughReviewers" class="text-xs text-warning">
            Add {{ minReviewers - picked.length }} more to meet the minimum.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="sendOpen = false" />
          <UButton
            label="Send for review"
            :loading="sending"
            :disabled="!enoughReviewers"
            @click="sendForReview"
          />
        </div>
      </template>
    </UModal>

    <ContentReviewModal v-model:open="reviewModalOpen" :content-id="id" @decided="refresh" />
  </div>
</template>
