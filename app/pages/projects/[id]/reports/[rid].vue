<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

import {
  PROJECT_REPORT_STATUS_COLOR,
  reportStatusLabel,
  type ProjectReportStatus,
} from '@@/shared/schemas/project'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const projectId = route.params.id as string
const rid = route.params.rid as string
const { can } = await usePermissions()
if (!can.value('project', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const { user } = useUserSession()
const myId = computed(() => (user.value as { id?: string } | null)?.id ?? '')
const toast = useToast()

interface ReportData {
  report: {
    id: string
    projectId: string
    title: string
    content: string | null
    status: ProjectReportStatus
    kind: string
    activityIds: string[]
    visibleToMembers: boolean
    approverUserId: string | null
    authorName: string | null
    approverName: string | null
    linkedActivities: { id: string; name: string }[]
    updatedAt: string
  }
  submittedReports: { id: string; title: string; authorName: string }[]
  permissions: {
    isLead: boolean
    isAuthor: boolean
    isApprover: boolean
    canWrite: boolean
    canSubmit: boolean
    canApprove: boolean
    canRecall: boolean
    canConfigure: boolean
  }
}
const { data, refresh } = await useFetch<ReportData>(`/api/projects/${projectId}/reports/${rid}`, {
  key: `report-${rid}`,
})
if (!data.value)
  throw createError({ statusCode: 404, statusMessage: 'Report not found', fatal: true })
useHead(() => ({ title: `${data.value?.report.title ?? 'Report'} — Camel OS` }))

const report = computed(() => data.value!.report)
const perms = computed(() => data.value!.permissions)
const isActivity = computed(() => report.value.kind === 'activity')
const canWrite = computed(() => perms.value.canWrite)

// Assignable users (for the approver) + this project's activities (for linking).
const { data: detail } = useFetch<{
  activities: { id: string; name: string; assignedUserId: string | null }[]
}>(`/api/projects/${projectId}`, {
  key: `project-${projectId}`,
  default: () => ({ activities: [] }),
})
const { data: usersData } = useFetch<{
  users: { id: string; firstName: string | null; lastName: string | null; email: string }[]
}>('/api/projects/assignable-users', { key: 'project-users', default: () => ({ users: [] }) })
const approverItems = computed(() => [
  { label: 'No approver assigned', value: '__none__' },
  ...(usersData.value?.users ?? []).map((u) => ({
    label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    value: u.id,
  })),
])
// An activity report links the author's own activities.
const myActivityItems = computed(() =>
  (detail.value?.activities ?? [])
    .filter((a) => a.assignedUserId === myId.value)
    .map((a) => ({ label: a.name, value: a.id }))
)

const title = ref('')
const linkedIds = ref<string[]>([])
const approverId = ref<string>('__none__')
const visibleToMembers = ref(false)
watchEffect(() => {
  const r = data.value?.report
  if (r) {
    title.value = r.title
    linkedIds.value = [...(r.activityIds ?? [])]
    approverId.value = r.approverUserId ?? '__none__'
    visibleToMembers.value = r.visibleToMembers
  }
})

// ── Tiptap editor (same config/look as the other document editors) ──
const editor = shallowRef<Editor>()
const saveState = ref<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
onMounted(() => {
  editor.value = new Editor({
    content: data.value?.report.content ?? '',
    editable: canWrite.value,
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
          'prose prose-slate max-w-none min-h-[50vh] px-6 py-6 sm:px-10 sm:py-8 focus:outline-none prose-headings:font-semibold prose-h2:text-xl prose-a:text-primary',
      },
    },
    onUpdate: () => {
      if (canWrite.value) saveState.value = 'dirty'
    },
  })
})
onBeforeUnmount(() => {
  if (saveState.value === 'dirty') void save()
  editor.value?.destroy()
})
watch(canWrite, (v) => editor.value?.setEditable(v))

async function save() {
  if (!editor.value) return
  saveState.value = 'saving'
  try {
    await $fetch(`/api/projects/${projectId}/reports/${rid}`, {
      method: 'PATCH',
      body: {
        title: title.value.trim() || 'Untitled report',
        content: editor.value.getHTML(),
        activityIds: isActivity.value ? linkedIds.value : undefined,
      },
    })
    saveState.value = 'saved'
    await refresh()
  } catch (err) {
    saveState.value = 'dirty'
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Save failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  }
}

const acting = ref(false)
async function setStatus(next: ProjectReportStatus, ok: string) {
  acting.value = true
  try {
    if (editor.value && canWrite.value)
      await $fetch(`/api/projects/${projectId}/reports/${rid}`, {
        method: 'PATCH',
        body: {
          title: title.value.trim() || 'Untitled report',
          content: editor.value.getHTML(),
          activityIds: isActivity.value ? linkedIds.value : undefined,
        },
      })
    await $fetch(`/api/projects/${projectId}/reports/${rid}`, {
      method: 'PATCH',
      body: { status: next },
    })
    toast.add({ title: ok, color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Action failed', description: msg, color: 'error' })
  } finally {
    acting.value = false
  }
}

// General-report configuration (approver + member visibility) — lead only.
async function saveConfig() {
  try {
    await $fetch(`/api/projects/${projectId}/reports/${rid}`, {
      method: 'PATCH',
      body: {
        approverUserId: approverId.value === '__none__' ? null : approverId.value,
        visibleToMembers: visibleToMembers.value,
      },
    })
    toast.add({ title: 'Report settings saved', color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  }
}

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
      icon: 'i-lucide-heading-2',
      label: 'Heading',
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
      label: 'Numbered',
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

function when(iso: string | undefined) {
  return iso
    ? new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
}
</script>

<template>
  <div v-if="data" class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-default/70 pb-5">
      <div class="min-w-0 flex-1">
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Back to project"
          class="-ml-2"
          @click="navigateTo(`/projects/${projectId}`)"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <UInput
            v-if="canWrite"
            v-model="title"
            size="lg"
            placeholder="Report title"
            class="max-w-md font-semibold"
          />
          <h1 v-else class="text-2xl font-semibold tracking-tight text-default">
            {{ report.title }}
          </h1>
          <UBadge
            v-if="report.kind === 'general'"
            color="primary"
            variant="subtle"
            label="General"
          />
          <UBadge
            :color="PROJECT_REPORT_STATUS_COLOR[report.status]"
            variant="subtle"
            :label="reportStatusLabel(report.status, report.kind)"
          />
        </div>
        <p class="mt-1 text-sm text-muted">
          By {{ report.authorName || '—' }} · updated {{ when(report.updatedAt) }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span v-if="canWrite" class="pr-1 text-xs text-muted">
          <template v-if="saveState === 'saving'">Saving…</template>
          <template v-else-if="saveState === 'saved'">Saved ✓</template>
          <template v-else-if="saveState === 'dirty'">Unsaved…</template>
        </span>
        <UButton
          v-if="canWrite"
          variant="outline"
          color="neutral"
          icon="i-lucide-save"
          label="Save"
          :loading="saveState === 'saving'"
          @click="save"
        />
        <UButton
          v-if="perms.canSubmit"
          icon="i-lucide-send"
          :label="isActivity ? 'Submit' : 'Send for review'"
          :loading="acting"
          @click="setStatus('in_review', isActivity ? 'Report submitted' : 'Sent for review')"
        />
        <UButton
          v-if="perms.canApprove"
          icon="i-lucide-check"
          color="success"
          label="Approve"
          :loading="acting"
          @click="setStatus('approved', 'Report approved')"
        />
        <UButton
          v-if="perms.canRecall"
          icon="i-lucide-undo-2"
          variant="outline"
          color="neutral"
          label="Recall to draft"
          :loading="acting"
          @click="setStatus('draft', 'Recalled to draft')"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <!-- Document -->
      <div class="lg:col-span-2">
        <div class="overflow-hidden rounded-xl bg-default shadow-sm ring-1 ring-default">
          <div
            v-if="canWrite"
            class="flex flex-wrap items-center gap-0.5 border-b border-default px-3 py-2"
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
          </div>
          <EditorContent v-if="editor" :editor="editor" class="bg-default" />
          <div v-else class="px-6 py-12 text-sm text-muted">Loading editor…</div>
        </div>
        <p v-if="!canWrite" class="mt-2 text-xs text-muted">
          Read-only — a report can only be edited by its author while it's a draft.
        </p>
      </div>

      <!-- Sidebar -->
      <div class="space-y-4">
        <!-- Activity report: link the activities it covers -->
        <UCard v-if="isActivity">
          <template #header>
            <h3 class="text-sm font-semibold text-default">Activities covered</h3>
          </template>
          <USelectMenu
            v-if="canWrite"
            v-model="linkedIds"
            :items="myActivityItems"
            value-key="value"
            multiple
            placeholder="Select your activities…"
            class="w-full"
          />
          <ul v-else-if="report.linkedActivities.length" class="space-y-1 text-sm">
            <li v-for="a in report.linkedActivities" :key="a.id" class="text-default">
              • {{ a.name }}
            </li>
          </ul>
          <p v-else class="text-sm text-muted">No activities linked.</p>
          <p v-if="canWrite" class="mt-2 text-xs text-muted">
            Link one or many of your activities to this report.
          </p>
        </UCard>

        <!-- General report: approver + visibility (lead only) -->
        <UCard v-if="report.kind === 'general'">
          <template #header>
            <h3 class="text-sm font-semibold text-default">Approval &amp; sharing</h3>
          </template>
          <div v-if="perms.canConfigure" class="space-y-3">
            <UFormField label="Approver" hint="Who signs off this report">
              <USelect
                v-model="approverId"
                :items="approverItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <USwitch
              v-model="visibleToMembers"
              label="Make this report visible to all project members"
            />
            <UButton size="sm" variant="soft" label="Save settings" @click="saveConfig" />
          </div>
          <dl v-else class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted">Approver</dt>
              <dd class="text-default">{{ report.approverName || 'Unassigned' }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted">Shared with members</dt>
              <dd class="text-default">{{ report.visibleToMembers ? 'Yes' : 'No' }}</dd>
            </div>
          </dl>
        </UCard>

        <!-- General report: reference submitted activity reports -->
        <UCard v-if="report.kind === 'general' && data.submittedReports.length">
          <template #header>
            <h3 class="text-sm font-semibold text-default">Submitted activity reports</h3>
          </template>
          <ul class="space-y-1.5 text-sm">
            <li
              v-for="s in data.submittedReports"
              :key="s.id"
              class="flex cursor-pointer items-center justify-between gap-2 hover:text-primary"
              @click="navigateTo(`/projects/${projectId}/reports/${s.id}`)"
            >
              <span class="truncate text-default">{{ s.title }}</span>
              <span class="shrink-0 text-xs text-muted">{{ s.authorName }}</span>
            </li>
          </ul>
          <p class="mt-2 text-xs text-muted">Open these to fold their content into the report.</p>
        </UCard>
      </div>
    </div>
  </div>
</template>
