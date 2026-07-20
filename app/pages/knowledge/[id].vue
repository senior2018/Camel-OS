<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

import {
  CONTEXT_KEYS,
  KNOWLEDGE_STATUS_COLOR,
  KNOWLEDGE_STATUS_LABEL,
  type KnowledgeStatus,
  type KnowledgeVisibility,
} from '@@/shared/schemas/knowledge'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
if (!can.value('knowledge', 'read'))
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
const toast = useToast()

interface Article {
  id: string
  kind: string
  title: string
  excerpt: string | null
  body: string | null
  category: string | null
  tags: string[]
  contextKeys: string[]
  visibility: KnowledgeVisibility
  allowedRoleIds: string[]
  status: KnowledgeStatus
  helpfulCount: number
  notHelpfulCount: number
  viewCount: number
  authorFirstName: string | null
  authorLastName: string | null
  updatedAt: string
}
const { data, refresh } = await useFetch<{
  article: Article
  myFeedback: boolean | null
  canManage: boolean
}>(`/api/knowledge/articles/${id}`, { key: `knowledge-${id}` })
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
useHead(() => ({ title: `${data.value?.article.title ?? 'Article'} — Camel OS` }))

const canManage = computed(() => data.value?.canManage ?? false)
const a = computed(() => data.value!.article)

const meta = reactive({
  title: '',
  excerpt: '',
  category: '',
  tags: [] as string[],
  contextKeys: [] as string[],
  visibility: 'everyone' as KnowledgeVisibility,
  allowedRoleIds: [] as string[],
})
watchEffect(() => {
  const x = data.value?.article
  if (x) {
    meta.title = x.title
    meta.excerpt = x.excerpt ?? ''
    meta.category = x.category ?? ''
    meta.tags = [...x.tags]
    meta.contextKeys = [...x.contextKeys]
    meta.visibility = x.visibility
    meta.allowedRoleIds = [...x.allowedRoleIds]
  }
})
const { data: rolesData } = canManage.value
  ? await useFetch<{ items: { id: string; name: string }[] }>('/api/knowledge/roles', {
      key: 'knowledge-roles',
      default: () => ({ items: [] }),
    })
  : { data: ref({ items: [] as { id: string; name: string }[] }) }
const roleItems = computed(() =>
  (rolesData.value?.items ?? []).map((r) => ({ label: r.name, value: r.id }))
)
const contextItems = CONTEXT_KEYS.map((k) => ({ label: k, value: k as string }))

const editing = ref(false)
const editor = shallowRef<Editor>()
const saving = ref(false)
onMounted(() => {
  editor.value = new Editor({
    content: a.value.body ?? '',
    editable: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Image,
    ],
    editorProps: {
      attributes: {
        class:
          'prose prose-slate max-w-none min-h-[45vh] px-6 py-6 sm:px-10 sm:py-8 focus:outline-none prose-headings:font-semibold prose-a:text-primary',
      },
    },
  })
})
onBeforeUnmount(() => editor.value?.destroy())
function startEdit() {
  editing.value = true
  editor.value?.setEditable(true)
}
const tagInput = ref('')
function addTag() {
  const t = tagInput.value.trim()
  if (t && !meta.tags.includes(t)) meta.tags.push(t)
  tagInput.value = ''
}
async function save(status?: KnowledgeStatus) {
  saving.value = true
  try {
    await $fetch(`/api/knowledge/articles/${id}`, {
      method: 'PATCH',
      body: {
        title: meta.title.trim() || 'Untitled',
        excerpt: meta.excerpt || null,
        body: editor.value?.getHTML() ?? '',
        category: meta.category || null,
        tags: meta.tags,
        contextKeys: meta.contextKeys,
        visibility: meta.visibility,
        allowedRoleIds: meta.visibility === 'restricted' ? meta.allowedRoleIds : [],
        ...(status ? { status } : {}),
      },
    })
    toast.add({ title: status === 'published' ? 'Published' : 'Saved', color: 'success' })
    editing.value = false
    editor.value?.setEditable(false)
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
async function feedback(helpful: boolean) {
  try {
    await $fetch(`/api/knowledge/articles/${id}/feedback`, { method: 'POST', body: { helpful } })
    toast.add({ title: 'Thanks for the feedback', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Could not save feedback', color: 'error' })
  }
}
const authorName = () =>
  [a.value.authorFirstName, a.value.authorLastName].filter(Boolean).join(' ') || 'Team'
</script>

<template>
  <div v-if="data" class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-default/70 pb-5">
      <div class="min-w-0 flex-1">
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Knowledge base"
          class="-ml-2"
          @click="navigateTo('/knowledge')"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <UInput v-if="editing" v-model="meta.title" size="lg" class="max-w-md font-semibold" />
          <h1 v-else class="text-2xl font-semibold tracking-tight text-default">{{ a.title }}</h1>
          <UBadge
            :color="KNOWLEDGE_STATUS_COLOR[a.status]"
            variant="subtle"
            :label="KNOWLEDGE_STATUS_LABEL[a.status]"
          />
          <UIcon
            v-if="a.visibility === 'restricted'"
            name="i-lucide-lock"
            class="size-4 text-muted"
          />
        </div>
        <p class="mt-1 text-sm text-muted">
          By {{ authorName() }} · {{ a.viewCount }} views · {{ a.helpfulCount }} found helpful
        </p>
      </div>
      <div v-if="canManage" class="flex items-center gap-2">
        <template v-if="editing">
          <UButton
            variant="outline"
            color="neutral"
            label="Save draft"
            :loading="saving"
            @click="save()"
          />
          <UButton
            icon="i-lucide-globe"
            color="success"
            label="Publish"
            :loading="saving"
            @click="save('published')"
          />
        </template>
        <template v-else>
          <UButton
            v-if="a.status === 'published'"
            variant="outline"
            color="neutral"
            icon="i-lucide-archive"
            label="Archive"
            @click="save('archived')"
          />
          <UButton icon="i-lucide-pencil" label="Edit" @click="startEdit" />
        </template>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <div class="overflow-hidden rounded-xl bg-default shadow-sm ring-1 ring-default">
          <EditorContent v-if="editor" :editor="editor" class="bg-default" />
        </div>
      </div>

      <div class="space-y-4">
        <!-- Reader feedback (KM-05) -->
        <UCard v-if="a.status === 'published' && !editing">
          <template #header
            ><h3 class="text-sm font-semibold text-default">Was this helpful?</h3></template
          >
          <div class="flex gap-2">
            <UButton
              :variant="data.myFeedback === true ? 'soft' : 'outline'"
              :color="data.myFeedback === true ? 'success' : 'neutral'"
              icon="i-lucide-thumbs-up"
              label="Yes"
              @click="feedback(true)"
            />
            <UButton
              :variant="data.myFeedback === false ? 'soft' : 'outline'"
              :color="data.myFeedback === false ? 'error' : 'neutral'"
              icon="i-lucide-thumbs-down"
              label="No"
              @click="feedback(false)"
            />
          </div>
        </UCard>

        <!-- Metadata / access (editing) -->
        <UCard v-if="editing">
          <template #header
            ><h3 class="text-sm font-semibold text-default">Details & access</h3></template
          >
          <div class="space-y-3">
            <UFormField label="Excerpt"
              ><UTextarea v-model="meta.excerpt" :rows="2" class="w-full"
            /></UFormField>
            <UFormField label="Category"
              ><UInput v-model="meta.category" placeholder="e.g. Delivery" class="w-full"
            /></UFormField>
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
                  >{{ t }}</UBadge
                >
              </div>
              <UInput
                v-model="tagInput"
                placeholder="Add tag + Enter"
                size="sm"
                class="mt-1"
                @keydown.enter.prevent="addTag"
              />
            </UFormField>
            <UFormField label="Visibility">
              <USelect
                v-model="meta.visibility"
                :items="[
                  { label: 'Everyone', value: 'everyone' },
                  { label: 'Restricted to roles', value: 'restricted' },
                ]"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField v-if="meta.visibility === 'restricted'" label="Allowed roles">
              <USelectMenu
                v-model="meta.allowedRoleIds"
                :items="roleItems"
                value-key="value"
                multiple
                placeholder="Pick roles…"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Show as contextual help on"
              hint="Surfaces this in the help panel on those modules"
            >
              <USelectMenu
                v-model="meta.contextKeys"
                :items="contextItems"
                value-key="value"
                multiple
                placeholder="Modules…"
                class="w-full"
              />
            </UFormField>
          </div>
        </UCard>

        <!-- Read-only taxonomy -->
        <UCard v-else-if="a.tags.length || a.category">
          <template #header><h3 class="text-sm font-semibold text-default">Topics</h3></template>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-if="a.category"
              color="primary"
              variant="subtle"
              size="xs"
              :label="a.category"
            />
            <UBadge
              v-for="t in a.tags"
              :key="t"
              variant="subtle"
              color="neutral"
              size="xs"
              :label="t"
            />
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
