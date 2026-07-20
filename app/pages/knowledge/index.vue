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
// KM-02 — managed category taxonomy
interface Cat {
  id: string
  name: string
  parentId: string | null
  path: string
}
const catOpen = ref(false)
const { data: cats, refresh: refreshCats } = await useFetch<{ items: Cat[] }>(
  '/api/knowledge/categories',
  { key: 'knowledge-categories', default: () => ({ items: [] }) }
)
const newCatName = ref('')
const newCatParent = ref('__top__')
const parentItems = computed(() => [
  { label: '— Top level —', value: '__top__' },
  ...(cats.value?.items ?? []).map((c) => ({ label: c.path, value: c.id })),
])
const savingCat = ref(false)
async function addCategory() {
  const name = newCatName.value.trim()
  if (!name || savingCat.value) return
  savingCat.value = true
  try {
    await $fetch('/api/knowledge/categories', {
      method: 'POST',
      body: { name, parentId: newCatParent.value === '__top__' ? null : newCatParent.value },
    })
    newCatName.value = ''
    newCatParent.value = '__top__'
    await refreshCats()
    toast.add({ title: 'Category added', color: 'success' })
  } catch {
    toast.add({ title: 'Could not add category', color: 'error' })
  } finally {
    savingCat.value = false
  }
}
async function deleteCategory(id: string) {
  try {
    await $fetch(`/api/knowledge/categories/${id}`, { method: 'DELETE' })
    await refreshCats()
  } catch {
    toast.add({ title: 'Could not delete', color: 'error' })
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
      <div v-if="data?.canManage" class="flex gap-2">
        <UButton
          icon="i-lucide-folder-tree"
          label="Categories"
          color="neutral"
          variant="outline"
          @click="catOpen = true"
        />
        <UButton icon="i-lucide-plus" label="New article" :loading="creating" @click="newArticle" />
      </div>
    </header>

    <UModal v-model:open="catOpen" title="Manage categories">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-muted">
            Organise the knowledge base into a nested taxonomy. Deleting a parent promotes its
            children to the top level.
          </p>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
            <UFormField label="Name" class="flex-1">
              <UInput
                v-model="newCatName"
                placeholder="e.g. Onboarding"
                class="w-full"
                @keydown.enter="addCategory"
              />
            </UFormField>
            <UFormField label="Parent" class="sm:w-48">
              <USelect v-model="newCatParent" :items="parentItems" class="w-full" />
            </UFormField>
            <UButton label="Add" :loading="savingCat" @click="addCategory" />
          </div>
          <div class="max-h-72 space-y-1 overflow-y-auto">
            <div
              v-for="c in cats?.items ?? []"
              :key="c.id"
              class="flex items-center justify-between rounded-lg border border-default px-3 py-2 text-sm"
            >
              <span class="truncate">{{ c.path }}</span>
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                @click="deleteCategory(c.id)"
              />
            </div>
            <p v-if="!(cats?.items ?? []).length" class="py-6 text-center text-sm text-muted">
              No categories yet.
            </p>
          </div>
        </div>
      </template>
    </UModal>

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
