<script setup lang="ts">
const props = defineProps<{
  page: number
  total: number
  pageSize: number
}>()
const emit = defineEmits<{ 'update:page': [value: number] }>()

const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const to = computed(() => Math.min(props.page * props.pageSize, props.total))
</script>

<template>
  <div
    v-if="total > pageSize"
    class="flex flex-col items-center justify-between gap-3 border-t border-default pt-3 sm:flex-row"
  >
    <p class="text-xs text-muted">
      Showing <span class="font-medium text-default">{{ from }}–{{ to }}</span> of
      <span class="font-medium text-default">{{ total }}</span>
    </p>
    <UPagination
      :page="page"
      :total="total"
      :items-per-page="pageSize"
      :sibling-count="1"
      show-edges
      @update:page="emit('update:page', $event)"
    />
  </div>
</template>
