<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { TableKit } from '@tiptap/extension-table'

/**
 * Communications content editor (CC-01). Rich text with headings, lists, links,
 * images, and tables. Autosaves the body every 60 seconds while dirty (and on
 * blur/unmount) to `content_items.body`.
 */
const props = withDefaults(
  defineProps<{ contentId: string; content: string | null; editable?: boolean }>(),
  { editable: false }
)
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
const saveState = ref<SaveState>('idle')
const editor = shallowRef<Editor>()
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  editor.value = new Editor({
    content: props.content ?? '',
    editable: props.editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image,
      Link.configure({ openOnClick: false, autolink: true }),
      TableKit.configure({ table: { resizable: true } }),
    ],
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[24rem] px-4 py-3',
      },
    },
    onUpdate: () => {
      if (props.editable) saveState.value = 'dirty'
    },
  })
  // CC-01 — autosave every 60 seconds when there are unsaved changes.
  if (props.editable) timer = setInterval(() => saveState.value === 'dirty' && save(), 60_000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (saveState.value === 'dirty') save()
  editor.value?.destroy()
})

watch(
  () => props.content,
  (val) => {
    const ed = editor.value
    if (
      ed &&
      !ed.isDestroyed &&
      (val ?? '') !== ed.getHTML() &&
      saveState.value !== 'saving' &&
      saveState.value !== 'dirty'
    ) {
      ed.commands.setContent(val ?? '', { emitUpdate: false })
    }
  }
)
watch(
  () => props.editable,
  (v) => editor.value?.setEditable(v)
)

async function save() {
  const ed = editor.value
  if (!ed) return
  saveState.value = 'saving'
  try {
    await $fetch(`/api/communications/content/${props.contentId}`, {
      method: 'PATCH',
      body: { body: ed.getHTML() },
    })
    saveState.value = 'saved'
    emit('saved')
  } catch (err) {
    saveState.value = 'error'
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Save failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  }
}
defineExpose({ saveNow: save, isDirty: () => saveState.value === 'dirty' })

// Treat whitespace-only / empty-paragraph HTML as "no content" so read-only
// viewers see a clear empty state instead of a blank box.
const hasContent = computed(() => {
  const text = (props.content ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return text.length > 0 || /<(img|table|hr|iframe)/i.test(props.content ?? '')
})

interface Tool {
  icon: string
  label: string
  run: () => void
  active?: () => boolean
}
const tools = computed<Tool[]>(() => {
  const ed = editor.value
  if (!ed) return []
  const c = () => ed.chain().focus()
  return [
    {
      icon: 'i-lucide-bold',
      label: 'Bold',
      run: () => c().toggleBold().run(),
      active: () => ed.isActive('bold'),
    },
    {
      icon: 'i-lucide-italic',
      label: 'Italic',
      run: () => c().toggleItalic().run(),
      active: () => ed.isActive('italic'),
    },
    {
      icon: 'i-lucide-heading-1',
      label: 'Heading 1',
      run: () => c().toggleHeading({ level: 1 }).run(),
      active: () => ed.isActive('heading', { level: 1 }),
    },
    {
      icon: 'i-lucide-heading-2',
      label: 'Heading 2',
      run: () => c().toggleHeading({ level: 2 }).run(),
      active: () => ed.isActive('heading', { level: 2 }),
    },
    {
      icon: 'i-lucide-list',
      label: 'Bullet list',
      run: () => c().toggleBulletList().run(),
      active: () => ed.isActive('bulletList'),
    },
    {
      icon: 'i-lucide-list-ordered',
      label: 'Numbered list',
      run: () => c().toggleOrderedList().run(),
      active: () => ed.isActive('orderedList'),
    },
    {
      icon: 'i-lucide-quote',
      label: 'Quote',
      run: () => c().toggleBlockquote().run(),
      active: () => ed.isActive('blockquote'),
    },
  ]
})

function setLink() {
  const ed = editor.value
  if (!ed) return
  const prev = ed.getAttributes('link').href as string | undefined
  const url = window.prompt('Link URL', prev ?? 'https://')
  if (url === null) return
  if (url.trim() === '') {
    ed.chain().focus().unsetLink().run()
    return
  }
  ed.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}
function addImage() {
  const url = window.prompt('Image URL')
  if (url?.trim()) editor.value?.chain().focus().setImage({ src: url.trim() }).run()
}
function addTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}
</script>

<template>
  <div class="flex min-h-0 flex-col rounded-lg border border-default">
    <div
      v-if="editable"
      class="flex flex-wrap items-center gap-0.5 border-b border-default bg-elevated/30 px-2 py-1.5"
    >
      <UButton
        v-for="t in tools"
        :key="t.label"
        :icon="t.icon"
        :color="t.active?.() ? 'primary' : 'neutral'"
        :variant="t.active?.() ? 'soft' : 'ghost'"
        size="xs"
        :aria-label="t.label"
        @click="t.run"
      />
      <UButton
        icon="i-lucide-link"
        size="xs"
        variant="ghost"
        color="neutral"
        aria-label="Link"
        @click="setLink"
      />
      <UButton
        icon="i-lucide-image"
        size="xs"
        variant="ghost"
        color="neutral"
        aria-label="Image"
        @click="addImage"
      />
      <UButton
        icon="i-lucide-table"
        size="xs"
        variant="ghost"
        color="neutral"
        aria-label="Table"
        @click="addTable"
      />
      <span
        class="ml-auto pr-1 text-xs"
        :class="saveState === 'error' ? 'text-error' : 'text-muted'"
      >
        <template v-if="saveState === 'saving'">Saving…</template>
        <template v-else-if="saveState === 'saved'">Saved ✓</template>
        <template v-else-if="saveState === 'dirty'">Unsaved…</template>
        <template v-else-if="saveState === 'error'">Save failed</template>
      </span>
    </div>
    <!-- Editable: the live editor. Guard on `editor` (not just `editable`) so the
         component never renders EditorContent with an undefined editor during SSR
         — that throws and blanks the whole editor. Editor is created onMounted. -->
    <EditorContent v-if="editable && editor" :editor="editor" class="flex-1 overflow-auto" />
    <div
      v-else-if="editable"
      class="flex-1 px-4 py-12 text-center text-sm text-muted"
    >
      Loading editor…
    </div>
    <!-- Read-only with content: render saved HTML as clean prose.
         Trusted internal content authored in-app. -->
    <!-- eslint-disable vue/no-v-html -->
    <div
      v-else-if="hasContent"
      class="prose prose-sm max-w-none flex-1 overflow-auto px-4 py-3"
      v-html="content"
    />
    <!-- eslint-enable vue/no-v-html -->
    <!-- Read-only, nothing written yet: explicit empty state -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center"
    >
      <UIcon name="i-lucide-file-text" class="size-8 text-muted" />
      <p class="text-sm font-medium text-default">No content written yet</p>
      <p class="max-w-xs text-xs text-muted">
        This item was sent for review without a body. Recall it to Draft to add content.
      </p>
    </div>
  </div>
</template>

