<script setup lang="ts">
import {
  EVALUATION_STATUS_COLOR,
  EVALUATION_STATUS_LABEL,
  evaluationSchema,
  type EvaluationStatus,
} from '@@/shared/schemas/mel'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Evaluations — Camel OS' })

const { can } = await usePermissions()
if (!can.value('mel', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canCreate = computed(() => can.value('mel', 'create'))

interface Row {
  id: string
  title: string
  status: EvaluationStatus
  projectName: string | null
  responses: number
  createdAt: string
}
const { data, status } = await useFetch<{ items: Row[] }>('/api/mel/evaluations', {
  key: 'evaluations',
  default: () => ({ items: [] }),
})

const toast = useToast()
const createOpen = ref(false)
const creating = ref(false)
const form = reactive({ title: '', description: '' })
async function create() {
  const parsed = evaluationSchema.safeParse({
    title: form.title,
    description: form.description || null,
  })
  if (!parsed.success) {
    toast.add({ title: 'A title is required', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const res = await $fetch<{ evaluation: { id: string } }>('/api/mel/evaluations', {
      method: 'POST',
      body: parsed.data,
    })
    createOpen.value = false
    await navigateTo(`/evaluations/${res.evaluation.id}`)
  } catch {
    toast.add({ title: 'Could not create evaluation', color: 'error' })
  } finally {
    creating.value = false
  }
}
function fdate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Evaluations</h1>
        <p class="mt-1 text-sm text-muted">
          Build questionnaires, distribute by link, and aggregate responses.
        </p>
      </div>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        label="New evaluation"
        @click="createOpen = true"
      />
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>
    <div
      v-else-if="!data?.items.length"
      class="rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-clipboard-list" class="size-10 text-muted" />
      <p class="mt-2 text-sm text-muted">No evaluations yet.</p>
    </div>
    <div v-else class="overflow-hidden rounded-xl border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Title</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2 font-medium">Responses</th>
            <th class="hidden px-4 py-2 font-medium sm:table-cell">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="e in data.items"
            :key="e.id"
            class="cursor-pointer hover:bg-elevated/40"
            @click="navigateTo(`/evaluations/${e.id}`)"
          >
            <td class="px-4 py-2.5 font-medium text-default">
              {{ e.title
              }}<span v-if="e.projectName" class="ml-1 text-xs text-muted"
                >· {{ e.projectName }}</span
              >
            </td>
            <td class="px-4 py-2.5">
              <UBadge
                :color="EVALUATION_STATUS_COLOR[e.status]"
                variant="subtle"
                size="xs"
                :label="EVALUATION_STATUS_LABEL[e.status]"
              />
            </td>
            <td class="px-4 py-2.5 text-muted">{{ e.responses }}</td>
            <td class="hidden px-4 py-2.5 text-muted sm:table-cell">{{ fdate(e.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="createOpen" title="New evaluation">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title" required
            ><UInput v-model="form.title" autofocus placeholder="e.g. Mid-term Stakeholder Survey"
          /></UFormField>
          <UFormField label="Description"
            ><UTextarea v-model="form.description" :rows="2" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="createOpen = false"
          /><UButton label="Create & build" :loading="creating" @click="create" /></div
      ></template>
    </UModal>
  </div>
</template>
