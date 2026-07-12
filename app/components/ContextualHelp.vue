<script setup lang="ts">
/**
 * HD-02 — a quiet, always-available help affordance. It derives the current
 * module from the route and surfaces the help docs pinned to that context, plus
 * a jump to the full knowledge base. Premium touch: opens as a right slideover,
 * never blocking the work surface.
 */
const route = useRoute()
const { can } = await usePermissions()
const allowed = computed(() => can.value('knowledge', 'read'))

const contextKey = computed(() => {
  const seg = route.path.split('/').filter(Boolean)[0] ?? ''
  const map: Record<string, string> = {
    opportunities: 'opportunities',
    proposals: 'proposals',
    clients: 'clients',
    projects: 'projects',
    communications: 'communications',
    campaigns: 'communications',
    stakeholders: 'communications',
    media: 'communications',
    library: 'library',
    evaluations: 'evaluations',
    lessons: 'lessons',
    hr: 'hr',
    experts: 'experts',
    timesheets: 'timesheets',
    leave: 'leave',
    strategy: 'strategy',
    finance: 'finance',
    procurement: 'procurement',
    knowledge: 'knowledge',
  }
  return map[seg] ?? ''
})

const open = ref(false)
interface Doc {
  id: string
  title: string
  excerpt: string | null
}
const items = ref<Doc[]>([])
const loading = ref(false)
async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ items: Doc[] }>('/api/knowledge/contextual', {
      query: { context: contextKey.value },
    })
    items.value = res.items
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}
watch(open, (v) => {
  if (v) load()
})
</script>

<template>
  <div v-if="allowed">
    <UButton
      icon="i-lucide-life-buoy"
      color="neutral"
      variant="soft"
      size="sm"
      class="fixed bottom-5 right-5 z-40 rounded-full shadow-lg"
      aria-label="Help"
      @click="open = true"
    />
    <USlideover v-model:open="open" title="Help & guidance">
      <template #body>
        <div class="space-y-3">
          <p class="text-xs text-muted">
            Guidance for
            <span class="font-medium text-default">{{ contextKey || 'this workspace' }}</span
            >.
          </p>
          <div v-if="loading" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
          </div>
          <div
            v-else-if="!items.length"
            class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
          >
            No help articles for this area yet.
          </div>
          <NuxtLink
            v-for="d in items"
            :key="d.id"
            :to="`/knowledge/${d.id}`"
            class="block rounded-lg border border-default bg-default p-3 shadow-sm transition-colors hover:border-primary/40"
            @click="open = false"
          >
            <p class="text-sm font-medium text-default">{{ d.title }}</p>
            <p v-if="d.excerpt" class="mt-0.5 line-clamp-2 text-xs text-muted">{{ d.excerpt }}</p>
          </NuxtLink>
        </div>
      </template>
      <template #footer>
        <UButton
          block
          variant="soft"
          icon="i-lucide-book-open"
          label="Browse the knowledge base"
          @click="(navigateTo('/knowledge'), (open = false))"
        />
      </template>
    </USlideover>
  </div>
</template>
