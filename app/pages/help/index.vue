<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Help Center — Camel OS' })

const { can } = await usePermissions()
if (!can.value('knowledge', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canManage = computed(
  () => can.value('knowledge', 'create') || can.value('knowledge', 'update')
)
const toast = useToast()

const tab = ref<'help' | 'videos' | 'whatsnew' | 'insights'>('help')
const tabs = computed(() => [
  { key: 'help' as const, label: 'Help & FAQs', icon: 'i-lucide-help-circle' },
  { key: 'videos' as const, label: 'Training Videos', icon: 'i-lucide-play-circle' },
  { key: 'whatsnew' as const, label: "What's New", icon: 'i-lucide-sparkles' },
  ...(canManage.value
    ? [{ key: 'insights' as const, label: 'Insights', icon: 'i-lucide-bar-chart-3' }]
    : []),
])

// Help articles (kind = help)
const searchInput = ref('')
const q = ref('')
let deb: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (deb) clearTimeout(deb)
  deb = setTimeout(() => (q.value = v), 250)
})
interface HelpDoc {
  id: string
  title: string
  excerpt: string | null
  category: string | null
  videoUrl?: string | null
}
const { data: helpData } = await useFetch<{ items: (HelpDoc & { videoUrl?: string | null })[] }>(
  '/api/knowledge/articles',
  {
    key: 'help-articles',
    query: computed(() => ({ kind: 'help', q: q.value || undefined })),
    default: () => ({ items: [] }),
  }
)
// Training videos are help docs carrying a videoUrl — surfaced separately.
const videos = computed(() => (helpData.value?.items ?? []).filter((d) => d.videoUrl))

// Release notes
interface Note {
  id: string
  version: string
  title: string
  body: string | null
  highlights: string[]
  releasedAt: string
  published: boolean
}
const { data: notesData, refresh: refreshNotes } = await useFetch<{
  items: Note[]
  canManage: boolean
}>('/api/help/release-notes', {
  key: 'release-notes',
  default: () => ({ items: [], canManage: false }),
})
const noteOpen = ref(false)
const noteForm = reactive({
  version: '',
  title: '',
  body: '',
  highlights: '',
  releasedAt: new Date().toISOString().slice(0, 10),
})
const savingNote = ref(false)
async function createNote() {
  if (!noteForm.version.trim() || !noteForm.title.trim()) return
  savingNote.value = true
  try {
    await $fetch('/api/help/release-notes', {
      method: 'POST',
      body: {
        version: noteForm.version,
        title: noteForm.title,
        body: noteForm.body || null,
        highlights: noteForm.highlights
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        releasedAt: noteForm.releasedAt,
        published: true,
      },
    })
    toast.add({ title: 'Release note published', color: 'success' })
    noteOpen.value = false
    Object.assign(noteForm, { version: '', title: '', body: '', highlights: '' })
    await refreshNotes()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not publish', description: msg, color: 'error' })
  } finally {
    savingNote.value = false
  }
}

// Analytics (managers)
const { data: statsData } = canManage.value
  ? await useFetch<{
      totals: { articles: number; help: number; views: number; helpful: number }
      topViewed: { id: string; title: string; viewCount: number; helpfulCount: number }[]
      topHelpful: { id: string; title: string; helpfulCount: number; notHelpfulCount: number }[]
    }>('/api/help/analytics', {
      key: 'help-analytics',
      default: () => ({
        totals: { articles: 0, help: 0, views: 0, helpful: 0 },
        topViewed: [],
        topHelpful: [],
      }),
    })
  : { data: ref(null) }
const when = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Help Center</h1>
        <p class="mt-1 text-sm text-muted">
          Guides, training, and what's new — everything you need to get the most from Camel OS.
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

    <!-- HELP & FAQs -->
    <div v-show="tab === 'help'" class="space-y-4">
      <UInput
        v-model="searchInput"
        icon="i-lucide-search"
        placeholder="Search help…"
        size="lg"
        class="sm:max-w-md"
      />
      <div
        v-if="!(helpData?.items ?? []).length"
        class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted"
      >
        No help articles yet.
      </div>
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NuxtLink
          v-for="d in helpData!.items"
          :key="d.id"
          :to="`/knowledge/${d.id}`"
          class="flex items-start gap-3 rounded-xl border border-default bg-default p-4 shadow-sm transition-colors hover:border-primary/40"
        >
          <UIcon
            :name="d.videoUrl ? 'i-lucide-play-circle' : 'i-lucide-file-text'"
            class="mt-0.5 size-5 shrink-0 text-primary"
          />
          <div class="min-w-0">
            <p class="font-medium text-default">{{ d.title }}</p>
            <p v-if="d.excerpt" class="mt-0.5 line-clamp-2 text-xs text-muted">{{ d.excerpt }}</p>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- TRAINING VIDEOS -->
    <div v-show="tab === 'videos'" class="space-y-4">
      <div
        v-if="!videos.length"
        class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted"
      >
        No training videos yet.<span v-if="canManage"> Add a help article with a video URL.</span>
      </div>
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a
          v-for="v in videos"
          :key="v.id"
          :href="v.videoUrl!"
          target="_blank"
          class="group flex flex-col overflow-hidden rounded-xl border border-default bg-default shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div
            class="flex aspect-video items-center justify-center bg-gradient-to-br from-primary/15 to-elevated"
          >
            <UIcon
              name="i-lucide-play"
              class="size-10 text-primary/70 transition-transform group-hover:scale-110"
            />
          </div>
          <div class="p-4">
            <p class="font-medium text-default">{{ v.title }}</p>
            <p v-if="v.excerpt" class="mt-0.5 line-clamp-2 text-xs text-muted">{{ v.excerpt }}</p>
          </div>
        </a>
      </div>
    </div>

    <!-- WHAT'S NEW -->
    <div v-show="tab === 'whatsnew'" class="space-y-4">
      <div v-if="notesData?.canManage" class="flex justify-end">
        <UButton size="sm" icon="i-lucide-plus" label="New release note" @click="noteOpen = true" />
      </div>
      <div
        v-if="!(notesData?.items ?? []).length"
        class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted"
      >
        No release notes yet.
      </div>
      <ol v-else class="relative space-y-5 border-l border-default pl-6">
        <li v-for="n in notesData!.items" :key="n.id" class="relative">
          <span
            class="absolute -left-[29px] top-1 flex size-3 items-center justify-center rounded-full bg-primary ring-4 ring-default"
          />
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="primary" variant="subtle" size="xs" :label="`v${n.version}`" />
            <span class="text-xs text-muted">{{ when(n.releasedAt) }}</span>
            <UBadge v-if="!n.published" color="neutral" variant="subtle" size="xs" label="Draft" />
          </div>
          <h3 class="mt-1 font-semibold text-default">{{ n.title }}</h3>
          <p v-if="n.body" class="mt-1 text-sm text-muted">{{ n.body }}</p>
          <ul v-if="n.highlights.length" class="mt-2 space-y-1">
            <li
              v-for="h in n.highlights"
              :key="h"
              class="flex items-start gap-2 text-sm text-default"
            >
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />{{ h }}
            </li>
          </ul>
        </li>
      </ol>
    </div>

    <!-- INSIGHTS -->
    <div v-show="tab === 'insights'" class="space-y-4">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">KB articles</p>
          <p class="mt-1 text-xl font-semibold text-default">{{ statsData?.totals.articles }}</p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Help docs</p>
          <p class="mt-1 text-xl font-semibold text-default">{{ statsData?.totals.help }}</p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Total views</p>
          <p class="mt-1 text-xl font-semibold text-default">{{ statsData?.totals.views }}</p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Found helpful</p>
          <p class="mt-1 text-xl font-semibold text-default">{{ statsData?.totals.helpful }}</p>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Most viewed</h3></template
          >
          <ul class="space-y-1.5 text-sm">
            <li
              v-for="a in statsData?.topViewed ?? []"
              :key="a.id"
              class="flex justify-between gap-2"
            >
              <NuxtLink
                :to="`/knowledge/${a.id}`"
                class="truncate text-default hover:text-primary"
                >{{ a.title }}</NuxtLink
              ><span class="shrink-0 text-muted">{{ a.viewCount }} views</span>
            </li>
            <li v-if="!(statsData?.topViewed ?? []).length" class="text-muted">No data yet.</li>
          </ul>
        </UCard>
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Most helpful</h3></template
          >
          <ul class="space-y-1.5 text-sm">
            <li
              v-for="a in statsData?.topHelpful ?? []"
              :key="a.id"
              class="flex justify-between gap-2"
            >
              <NuxtLink
                :to="`/knowledge/${a.id}`"
                class="truncate text-default hover:text-primary"
                >{{ a.title }}</NuxtLink
              ><span class="shrink-0 text-success">▲ {{ a.helpfulCount }}</span>
            </li>
            <li v-if="!(statsData?.topHelpful ?? []).length" class="text-muted">No data yet.</li>
          </ul>
        </UCard>
      </div>
    </div>

    <UModal v-model:open="noteOpen" title="New release note">
      <template #body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Version"
              ><UInput v-model="noteForm.version" placeholder="1.2.0" class="w-full"
            /></UFormField>
            <UFormField label="Date"
              ><UInput v-model="noteForm.releasedAt" type="date" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Title"><UInput v-model="noteForm.title" class="w-full" /></UFormField>
          <UFormField label="Summary"
            ><UTextarea v-model="noteForm.body" :rows="2" class="w-full"
          /></UFormField>
          <UFormField label="Highlights" hint="one per line"
            ><UTextarea v-model="noteForm.highlights" :rows="4" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="noteOpen = false" />
          <UButton label="Publish" :loading="savingNote" @click="createNote" />
        </div>
      </template>
    </UModal>
  </div>
</template>
