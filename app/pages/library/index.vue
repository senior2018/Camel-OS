<script setup lang="ts">
import { CONTENT_TYPE_LABEL } from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Insights Library — Camel OS' })

const { can } = await usePermissions()
if (!can.value('communications', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

interface Item {
  id: string
  title: string
  type: string
  category: string | null
  excerpt: string | null
  tags: string[]
  coverImageUrl: string | null
  authorFirstName: string | null
  authorLastName: string | null
  publishedAt: string | null
}
interface Author {
  id: string
  name: string
}

const searchInput = ref('')
const q = ref('')
const category = ref<string | undefined>(undefined)
const author = ref<string | undefined>(undefined)
const from = ref('')
const to = ref('')
const page = ref(1)

let debounce: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    q.value = v
    page.value = 1
  }, 300)
})
watch([category, author, from, to], () => (page.value = 1))

const query = computed(() => ({
  q: q.value || undefined,
  category: category.value || undefined,
  author: author.value || undefined,
  from: from.value || undefined,
  to: to.value || undefined,
  page: page.value,
}))

const { data, status } = await useFetch<{
  items: Item[]
  total: number
  page: number
  pageSize: number
  categories: string[]
  authors: Author[]
}>('/api/communications/library', { query, key: 'library' })

const totalPages = computed(() =>
  Math.max(1, Math.ceil((data.value?.total ?? 0) / (data.value?.pageSize ?? 12)))
)
const categoryItems = computed(() => [
  { label: 'All categories', value: '' },
  ...(data.value?.categories ?? []).map((c) => ({ label: c, value: c })),
])
const authorItems = computed(() => [
  { label: 'All authors', value: '' },
  ...(data.value?.authors ?? []).map((a) => ({ label: a.name, value: a.id })),
])
const hasFilters = computed(
  () => !!q.value || !!category.value || !!author.value || !!from.value || !!to.value
)
function clearFilters() {
  searchInput.value = ''
  q.value = ''
  category.value = undefined
  author.value = undefined
  from.value = ''
  to.value = ''
  page.value = 1
}

const typeLabel = (t: string) => (CONTENT_TYPE_LABEL as Record<string, string>)[t] ?? t
function authorName(i: Item) {
  return [i.authorFirstName, i.authorLastName].filter(Boolean).join(' ') || 'Sahara Consult'
}
function when(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-default">Insights Library</h1>
      <p class="mt-1 text-sm text-muted">
        Published insights and reports from across the firm — searchable and shareable.
      </p>
    </header>

    <!-- Search + filters -->
    <div class="space-y-2">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <UInput
          v-model="searchInput"
          icon="i-lucide-search"
          placeholder="Search insights…"
          size="lg"
          class="sm:max-w-md"
        />
        <USelect
          v-model="category"
          :items="categoryItems"
          value-key="value"
          placeholder="Category"
          class="sm:w-44"
        />
        <USelect
          v-model="author"
          :items="authorItems"
          value-key="value"
          placeholder="Author"
          class="sm:w-44"
        />
        <UButton
          v-if="hasFilters"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          label="Clear"
          size="sm"
          @click="clearFilters"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Published between</span>
        <UInput v-model="from" type="date" size="xs" />
        <span>and</span>
        <UInput v-model="to" type="date" size="xs" />
        <span class="sm:ml-auto"
          >{{ data?.total ?? 0 }} result{{ (data?.total ?? 0) === 1 ? '' : 's' }}</span
        >
      </div>
    </div>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <div
      v-else-if="!data?.items.length"
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-library" class="size-10 text-muted" />
      <p class="text-sm text-muted">No published insights match your search.</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="i in data.items"
        :key="i.id"
        class="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-default bg-default transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
        @click="navigateTo(`/library/${i.id}`)"
      >
        <div
          v-if="i.coverImageUrl"
          class="aspect-[16/9] bg-cover bg-center"
          :style="{ backgroundImage: `url(${i.coverImageUrl})` }"
        />
        <div
          v-else
          class="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary/10 to-elevated"
        >
          <UIcon name="i-lucide-newspaper" class="size-10 text-primary/40" />
        </div>
        <div class="flex flex-1 flex-col p-4">
          <div class="flex items-center gap-2 text-xs text-muted">
            <UBadge color="primary" variant="subtle" size="xs" :label="typeLabel(i.type)" />
            <span v-if="i.category">· {{ i.category }}</span>
          </div>
          <h2 class="mt-2 line-clamp-2 font-semibold text-default group-hover:text-primary">
            {{ i.title }}
          </h2>
          <p v-if="i.excerpt" class="mt-1 line-clamp-3 text-sm text-muted">{{ i.excerpt }}</p>
          <div class="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-muted">
            <span class="truncate">{{ authorName(i) }}</span>
            <span class="shrink-0">{{ when(i.publishedAt) }}</span>
          </div>
        </div>
      </article>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-3">
      <UButton
        icon="i-lucide-chevron-left"
        variant="outline"
        color="neutral"
        size="sm"
        :disabled="page <= 1"
        @click="page--"
      />
      <span class="text-sm text-muted">Page {{ page }} of {{ totalPages }}</span>
      <UButton
        icon="i-lucide-chevron-right"
        variant="outline"
        color="neutral"
        size="sm"
        :disabled="page >= totalPages"
        @click="page++"
      />
    </div>
  </div>
</template>
