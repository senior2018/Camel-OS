<script setup lang="ts">
const props = withDefaults(defineProps<{ proposalId: string; canWrite?: boolean }>(), {
  canWrite: false,
})

interface Section {
  id: string
  title: string
  body: string | null
  sortOrder: number
  assignedToUserId: string | null
  assignedToFirstName: string | null
  assignedToLastName: string | null
  updatedAt: string
}

const toast = useToast()
const { data, refresh } = await useFetch<{ sections: Section[] }>(
  () => `/api/proposals/${props.proposalId}/sections`,
  { key: () => `proposal-sections-${props.proposalId}`, default: () => ({ sections: [] }) }
)
const sections = computed(() => data.value?.sections ?? [])

interface TeamMember {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}
const { data: teamData } = await useFetch<{ members: TeamMember[] }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})
const ownerItems = computed(() => [
  { label: 'Unassigned', value: null as string | null },
  ...(teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id as string | null,
  })),
])

// Local edit buffers keyed by section id.
const drafts = reactive<Record<string, { body: string; assignedToUserId: string | null }>>({})
watch(
  sections,
  (list) => {
    for (const s of list) {
      if (!drafts[s.id]) drafts[s.id] = { body: s.body ?? '', assignedToUserId: s.assignedToUserId }
    }
  },
  { immediate: true }
)

const busy = ref(false)
async function api(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
) {
  busy.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}/sections${path}`, {
      method: method as 'POST',
      body,
    })
    await refresh()
    return true
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
    return false
  } finally {
    busy.value = false
  }
}

const newTitle = ref('')
async function addSection() {
  if (!newTitle.value.trim()) return
  if (await api('', 'POST', { title: newTitle.value.trim() })) newTitle.value = ''
}
async function seedTemplate() {
  await api('', 'POST', { seedTemplate: true })
}
async function saveSection(s: Section) {
  const d = drafts[s.id]
  if (!d) return
  const ok = await api(`/${s.id}`, 'PATCH', { body: d.body, assignedToUserId: d.assignedToUserId })
  if (ok) toast.add({ title: 'Section saved', color: 'success' })
}
async function deleteSection(s: Section) {
  await api(`/${s.id}`, 'DELETE')
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Proposal sections</h3>
        <span class="text-xs text-muted">{{ sections.length }} section(s)</span>
      </div>
    </template>

    <div class="space-y-4">
      <div
        v-if="!sections.length"
        class="rounded-lg border border-dashed border-default p-6 text-center"
      >
        <p class="text-sm text-muted">No sections yet.</p>
        <div v-if="canWrite" class="mt-3 flex justify-center gap-2">
          <UButton
            size="sm"
            icon="i-lucide-layout-template"
            label="Use template"
            :loading="busy"
            @click="seedTemplate"
          />
        </div>
      </div>

      <div v-for="s in sections" :key="s.id" class="rounded-lg border border-default p-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <p class="text-sm font-medium text-default">{{ s.title }}</p>
          <div v-if="canWrite" class="flex items-center gap-2">
            <USelect
              v-model="drafts[s.id]!.assignedToUserId"
              :items="ownerItems"
              value-key="value"
              size="xs"
              class="w-44"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              :loading="busy"
              @click="deleteSection(s)"
            />
          </div>
          <UBadge
            v-else-if="s.assignedToUserId"
            variant="subtle"
            color="neutral"
            size="xs"
            :label="[s.assignedToFirstName, s.assignedToLastName].filter(Boolean).join(' ')"
          />
        </div>
        <UTextarea
          v-if="canWrite"
          v-model="drafts[s.id]!.body"
          :rows="4"
          placeholder="Write this section…"
          class="w-full"
        />
        <p v-else-if="s.body" class="whitespace-pre-wrap text-sm text-default">{{ s.body }}</p>
        <p v-else class="text-sm text-muted">Empty.</p>
        <div v-if="canWrite" class="mt-2 flex justify-end">
          <UButton size="xs" label="Save section" :loading="busy" @click="saveSection(s)" />
        </div>
      </div>

      <div
        v-if="canWrite && sections.length"
        class="flex items-end gap-2 border-t border-default pt-3"
      >
        <UFormField label="Add a section" class="flex-1">
          <UInput v-model="newTitle" placeholder="Section title…" class="w-full" />
        </UFormField>
        <UButton
          size="sm"
          label="Add"
          :loading="busy"
          :disabled="!newTitle.trim()"
          @click="addSection"
        />
      </div>
    </div>
  </UCard>
</template>
