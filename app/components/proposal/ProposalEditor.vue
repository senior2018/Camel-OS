<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

/**
 * Proposal document editor (redesign v2, P2).
 *
 * A single rich-text surface — no fixed sections, no per-block Save. Writers
 * compose freely; content autosaves (debounced) to `proposals.contentDraft` as
 * HTML. Read-only viewers get the rendered document. Capped height with internal
 * scroll so the page never grows unbounded. Real-time co-editing arrives in P4.
 */
const props = withDefaults(
  defineProps<{ proposalId: string; content: string | null; editable?: boolean }>(),
  { editable: false }
)

const toast = useToast()
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
const saveState = ref<SaveState>('idle')
let saveTimer: ReturnType<typeof setTimeout> | null = null

const editor = shallowRef<Editor>()

onMounted(() => {
  editor.value = new Editor({
    content: props.content ?? '',
    editable: props.editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[18rem] px-4 py-3',
      },
    },
    onUpdate: () => {
      if (props.editable) scheduleSave()
    },
  })
})

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  editor.value?.destroy()
})

// Keep the editor in sync when the proposal is refreshed from the server and the
// local doc isn't mid-edit.
watch(
  () => props.content,
  (val) => {
    const ed = editor.value
    if (ed && !ed.isDestroyed && (val ?? '') !== ed.getHTML() && saveState.value !== 'saving') {
      ed.commands.setContent(val ?? '', { emitUpdate: false })
    }
  }
)
watch(
  () => props.editable,
  (v) => editor.value?.setEditable(v)
)

function scheduleSave() {
  saveState.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 900)
}

async function save() {
  const ed = editor.value
  if (!ed) return
  try {
    await $fetch(`/api/proposals/${props.proposalId}`, {
      method: 'PATCH',
      body: { contentDraft: ed.getHTML() },
    })
    saveState.value = 'saved'
  } catch (err) {
    saveState.value = 'error'
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Save failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  }
}

// PM-03 — version history.
interface DocVersion {
  id: string
  content: string | null
  createdAt: string
  savedByFirstName: string | null
  savedByLastName: string | null
}
const historyOpen = ref(false)
const versions = ref<DocVersion[]>([])
const loadingHistory = ref(false)
async function openHistory() {
  historyOpen.value = true
  loadingHistory.value = true
  try {
    const res = await $fetch<{ versions: DocVersion[] }>(
      `/api/proposals/${props.proposalId}/document-versions`
    )
    versions.value = res.versions
  } catch {
    versions.value = []
  } finally {
    loadingHistory.value = false
  }
}
function restoreVersion(v: DocVersion) {
  const ed = editor.value
  if (!ed) return
  ed.commands.setContent(v.content ?? '', { emitUpdate: false })
  historyOpen.value = false
  save()
}
function versionAuthor(v: DocVersion): string {
  return [v.savedByFirstName, v.savedByLastName].filter(Boolean).join(' ') || 'User'
}
function versionTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// EX-04 — insert an expert's CV into the proposal document.
interface PickerExpert {
  userId: string
  firstName: string | null
  lastName: string | null
  headline: string | null
}
const cvPickerOpen = ref(false)
const experts = ref<PickerExpert[]>([])
const loadingExperts = ref(false)
const insertingId = ref<string | null>(null)
async function openCvPicker() {
  cvPickerOpen.value = true
  if (experts.value.length) return
  loadingExperts.value = true
  try {
    const res = await $fetch<{ items: PickerExpert[] }>('/api/experts/picker')
    experts.value = res.items
  } catch {
    experts.value = []
  } finally {
    loadingExperts.value = false
  }
}
function expertName(e: PickerExpert) {
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || 'Expert'
}
async function insertCv(e: PickerExpert) {
  const ed = editor.value
  if (!ed) return
  insertingId.value = e.userId
  try {
    const res = await $fetch<{ html: string }>(`/api/experts/${e.userId}/cv`)
    ed.chain().focus().insertContent(res.html).run()
    cvPickerOpen.value = false
    save()
  } catch {
    toast.add({ title: 'Could not insert CV', color: 'error' })
  } finally {
    insertingId.value = null
  }
}

interface ToolAction {
  icon: string
  label: string
  run: () => void
  active?: () => boolean
}
const tools = computed<ToolAction[]>(() => {
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
      icon: 'i-lucide-strikethrough',
      label: 'Strike',
      run: () => c().toggleStrike().run(),
      active: () => ed.isActive('strike'),
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
    { icon: 'i-lucide-minus', label: 'Divider', run: () => c().setHorizontalRule().run() },
    { icon: 'i-lucide-undo', label: 'Undo', run: () => c().undo().run() },
    { icon: 'i-lucide-redo', label: 'Redo', run: () => c().redo().run() },
  ]
})
</script>

<template>
  <div class="flex min-h-0 flex-col rounded-lg border border-default">
    <!-- Toolbar (writers only) -->
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
        class="ml-auto"
        icon="i-lucide-user-plus"
        size="xs"
        variant="ghost"
        color="neutral"
        label="Insert CV"
        @click="openCvPicker"
      />
      <UButton
        icon="i-lucide-history"
        size="xs"
        variant="ghost"
        color="neutral"
        label="History"
        @click="openHistory"
      />
      <span class="pr-1 text-xs" :class="saveState === 'error' ? 'text-error' : 'text-muted'">
        <template v-if="saveState === 'saving'">Saving…</template>
        <template v-else-if="saveState === 'saved'">Saved ✓</template>
        <template v-else-if="saveState === 'error'">Save failed</template>
      </span>
    </div>

    <!-- PM-03 version history -->
    <UModal v-model:open="historyOpen" title="Version history">
      <template #body>
        <div v-if="loadingHistory" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>
        <ul v-else-if="versions.length" class="divide-y divide-default">
          <li
            v-for="v in versions"
            :key="v.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-default">{{ versionTime(v.createdAt) }}</p>
              <p class="truncate text-xs text-muted">by {{ versionAuthor(v) }}</p>
            </div>
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-rotate-ccw"
              label="Restore"
              @click="restoreVersion(v)"
            />
          </li>
        </ul>
        <p v-else class="py-8 text-center text-sm text-muted">No saved versions yet.</p>
      </template>
    </UModal>

    <!-- EX-04 insert-CV picker -->
    <UModal v-model:open="cvPickerOpen" title="Insert expert CV">
      <template #body>
        <div v-if="loadingExperts" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>
        <ul v-else-if="experts.length" class="divide-y divide-default">
          <li
            v-for="e in experts"
            :key="e.userId"
            class="flex items-center justify-between gap-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-default">{{ expertName(e) }}</p>
              <p class="truncate text-xs text-muted">{{ e.headline ?? '—' }}</p>
            </div>
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-file-plus"
              label="Insert"
              :loading="insertingId === e.userId"
              @click="insertCv(e)"
            />
          </li>
        </ul>
        <p v-else class="py-8 text-center text-sm text-muted">
          No expert profiles yet. Build them in the Expert Database.
        </p>
      </template>
    </UModal>

    <!-- Document — fills available height, internal scroll -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <EditorContent v-if="editor" :editor="editor" />
      <p
        v-if="editor && editable && editor.isEmpty"
        class="pointer-events-none -mt-10 px-4 text-sm text-muted"
      >
        Start writing the proposal…
      </p>
    </div>
  </div>
</template>
