<script setup lang="ts">
import { CONTENT_TYPE_LABEL } from '@@/shared/schemas/communication'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string

interface Content {
  id: string
  title: string
  type: string
  category: string | null
  excerpt: string | null
  body: string | null
  coverImageUrl: string | null
  tags: string[]
  authorFirstName: string | null
  authorLastName: string | null
  publishedAt: string | null
}

const { data } = await useFetch<{ content: Content }>(`/api/communications/library/${id}`, {
  key: `library-${id}`,
})
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })

useHead(() => ({ title: `${data.value?.content.title} — Camel OS` }))

const typeLabel = (t: string) => (CONTENT_TYPE_LABEL as Record<string, string>)[t] ?? t
function authorName() {
  const c = data.value?.content
  return [c?.authorFirstName, c?.authorLastName].filter(Boolean).join(' ') || 'Sahara Consult'
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
  <div v-if="data" class="mx-auto max-w-4xl space-y-4">
    <UButton
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      label="Back to library"
      class="-ml-2"
      @click="navigateTo('/library')"
    />

    <!-- The article as a white "page" floating on the canvas — cover image
         full-bleed at the top, then generously padded content. -->
    <article class="overflow-hidden rounded-2xl bg-default shadow-sm ring-1 ring-default">
      <div
        v-if="data.content.coverImageUrl"
        class="aspect-[21/9] bg-cover bg-center"
        :style="{ backgroundImage: `url(${data.content.coverImageUrl})` }"
      />

      <div class="px-6 py-8 sm:px-10 sm:py-10">
        <header class="space-y-3">
          <div class="flex items-center gap-2 text-sm text-muted">
            <UBadge
              color="primary"
              variant="subtle"
              size="xs"
              :label="typeLabel(data.content.type)"
            />
            <span v-if="data.content.category">· {{ data.content.category }}</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-default">{{ data.content.title }}</h1>
          <p v-if="data.content.excerpt" class="text-lg text-muted">{{ data.content.excerpt }}</p>
          <div class="flex items-center gap-2 text-sm text-muted">
            <span class="font-medium text-default">{{ authorName() }}</span>
            <span>·</span>
            <span>{{ when(data.content.publishedAt) }}</span>
          </div>
        </header>

        <!-- Body is Tiptap HTML authored by trusted internal staff. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="prose prose-slate mt-6 max-w-none prose-headings:font-semibold prose-a:text-primary prose-img:rounded-xl prose-img:shadow-sm prose-img:ring-1 prose-img:ring-default"
          v-html="data.content.body"
        />

        <div
          v-if="data.content.tags.length"
          class="mt-8 flex flex-wrap gap-1 border-t border-default pt-4"
        >
          <UBadge
            v-for="t in data.content.tags"
            :key="t"
            variant="subtle"
            color="neutral"
            size="xs"
          >
            {{ t }}
          </UBadge>
        </div>
      </div>
    </article>
  </div>
</template>
