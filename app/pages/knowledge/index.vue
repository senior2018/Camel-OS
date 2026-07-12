<script setup lang="ts">
import {
  KNOWLEDGE_STATUS_COLOR,
  KNOWLEDGE_STATUS_LABEL,
  type KnowledgeStatus,
} from '@@/shared/schemas/knowledge'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Knowledge Base — Camel OS' })

const { can } = await usePermissions()
if (!can.value('knowledge', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const toast = useToast()

const searchInput = ref('')
const q = ref('')
const category = ref<string | undefined>(undefined)
let debounce: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => (q.value = v), 250)
})

interface Article {
  id: string
  title: string
  excerpt: string | null
  category: string | null
  tags: string[]
  status: KnowledgeStatus
  visibility: 'everyone' | 'restricted'
  helpfulCount: number
  viewCount: number
  authorFirstName: string | null
  authorLastName: string | null
  updatedAt: string
}
const query = computed(() => ({ q: q.value || undefined, category: category.value || undefined }))
const { data } = await useFetch<{
  items: Article[]
  categories: string[]
  canManage: boolean
}>('/api/knowledge/articles', {
  key: 'knowledge-list',
  query,
  default: () => ({ items: [], categories: [], canManage: false }),
})

const creating = ref(false)
async function newArticle() {
  if (creating.value) return
  creating.value = true
  try {
    const res = await $fetch<{ article: { id: string } }>('/api/knowledge/articles', {
      method: 'POST',
      body: { kind: 'article', title: 'Untitled article' },
    })
    await navigateTo(`/knowledge/${res.article.id}`)
  } catch {
    toast.add({ title: 'Could not create', color: 'error' })
  } finally {
    creating.value = false
  }
}
const author = (a: Article) =>
  [a.authorFirstName, a.authorLastName].filter(Boolean).join(' ') || 'Team'
const when = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Knowledge Base</h1>
        <p class="mt-1 text-sm text-muted">
          Playbooks, SOPs, templates, and institutional know-how — searchable and curated.
        </p>
      </div>
      <UButton
        v-if="data?.canManage"
        icon="i-lucide-plus"
        label="New article"
        :loading="creating"
        @click="newArticle"
      />
    </header>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <UInput
        v-model="searchInput"
        icon="i-lucide-search"
        placeholder="Search the knowledge base…"
        size="lg"
        class="sm:max-w-md"
      />
      <div class="flex flex-wrap gap-1">
        <UButton
          size="xs"
          :variant="!category ? 'soft' : 'ghost'"
          :color="!category ? 'primary' : 'neutral'"
          label="All"
          @click="category = undefined"
        />
        <UButton
          v-for="c in data?.categories ?? []"
          :key="c"
          size="xs"
          :variant="category === c ? 'soft' : 'ghost'"
          :color="category === c ? 'primary' : 'neutral'"
          :label="c"
          @click="category = c"
        />
      </div>
      <span class="text-xs text-muted sm:ml-auto">{{ data?.items.length ?? 0 }} articles</span>
    </div>

    <div
      v-if="!(data?.items ?? []).length"
      class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
    >
      No articles found.
    </div>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="a in data!.items"
        :key="a.id"
        class="group flex cursor-pointer flex-col rounded-xl border border-default bg-default p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
        @click="navigateTo(`/knowledge/${a.id}`)"
      >
        <div class="flex items-center gap-2 text-xs">
          <UBadge
            v-if="a.category"
            color="primary"
            variant="subtle"
            size="xs"
            :label="a.category"
          />
          <UBadge
            v-if="a.status !== 'published'"
            :color="KNOWLEDGE_STATUS_COLOR[a.status]"
            variant="subtle"
            size="xs"
            :label="KNOWLEDGE_STATUS_LABEL[a.status]"
          />
          <UIcon
            v-if="a.visibility === 'restricted'"
            name="i-lucide-lock"
            class="size-3 text-muted"
          />
        </div>
        <h2 class="mt-2 line-clamp-2 font-semibold text-default group-hover:text-primary">
          {{ a.title }}
        </h2>
        <p v-if="a.excerpt" class="mt-1 line-clamp-3 flex-1 text-sm text-muted">{{ a.excerpt }}</p>
        <div
          class="mt-3 flex items-center justify-between gap-2 border-t border-default pt-3 text-xs text-muted"
        >
          <span class="truncate">{{ author(a) }} · {{ when(a.updatedAt) }}</span>
          <span class="flex shrink-0 items-center gap-2">
            <span class="flex items-center gap-0.5"
              ><UIcon name="i-lucide-eye" class="size-3" />{{ a.viewCount }}</span
            >
            <span class="flex items-center gap-0.5"
              ><UIcon name="i-lucide-thumbs-up" class="size-3" />{{ a.helpfulCount }}</span
            >
          </span>
        </div>
      </article>
    </div>
  </div>
</template>
