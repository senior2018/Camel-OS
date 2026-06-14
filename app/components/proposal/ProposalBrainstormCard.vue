<script setup lang="ts">
const props = withDefaults(
  defineProps<{ proposalId: string; brainstorm: string | null; canWrite?: boolean }>(),
  { canWrite: false }
)
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()
const text = ref(props.brainstorm ?? '')
watch(
  () => props.brainstorm,
  (v) => {
    text.value = v ?? ''
  }
)
const dirty = computed(() => text.value !== (props.brainstorm ?? ''))

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}`, {
      method: 'PATCH',
      body: { brainstorm: text.value || null },
    })
    toast.add({ title: 'Brainstorm saved', color: 'success' })
    emit('changed')
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Brainstorm</h3>
        <UButton v-if="canWrite && dirty" size="xs" label="Save" :loading="saving" @click="save" />
      </div>
    </template>
    <UTextarea
      v-if="canWrite"
      v-model="text"
      :rows="6"
      placeholder="Capture ideas, angles, win themes, questions — bullet points welcome…"
      class="w-full"
    />
    <p v-else-if="text" class="whitespace-pre-wrap text-sm text-default">{{ text }}</p>
    <p v-else class="text-sm text-muted">No brainstorming notes yet.</p>
  </UCard>
</template>
