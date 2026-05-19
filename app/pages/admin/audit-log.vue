<script setup lang="ts">
import type { AuditLogFilters } from '@@/shared/schemas/audit-log'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Audit log — Camel OS' })

const filters = ref<Partial<AuditLogFilters>>({
  page: 1,
  pageSize: 50,
})

// Bind form inputs to local strings so empty == undefined in the actual query.
const form = reactive({
  resource: '',
  action: '',
  from: '',
  to: '',
})

function applyFilters() {
  filters.value = {
    page: 1,
    pageSize: 50,
    resource: form.resource || undefined,
    action: form.action || undefined,
    from: form.from ? new Date(form.from).toISOString() : undefined,
    to: form.to ? new Date(form.to).toISOString() : undefined,
  }
}

function clearFilters() {
  form.resource = ''
  form.action = ''
  form.from = ''
  form.to = ''
  applyFilters()
}

const { data, status, downloadCsv } = useAdminAuditLog(filters)

const totalPages = computed(() => {
  if (!data.value) return 1
  return Math.max(1, Math.ceil(data.value.total / (data.value.pageSize || 50)))
})

function setPage(next: number) {
  if (next < 1 || next > totalPages.value) return
  filters.value = { ...filters.value, page: next }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Audit log</h1>
        <p class="mt-1 text-sm text-muted">
          Every authentication and administrative action is recorded with user, timestamp, and
          metadata.
        </p>
      </div>
      <UButton
        size="lg"
        variant="outline"
        icon="i-lucide-download"
        label="Export CSV"
        @click="downloadCsv"
      />
    </header>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
      </template>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField label="Resource">
          <UInput v-model="form.resource" placeholder="e.g. auth, user, role" />
        </UFormField>
        <UFormField label="Action">
          <UInput v-model="form.action" placeholder="e.g. login, password_changed" />
        </UFormField>
        <UFormField label="From">
          <UInput v-model="form.from" type="datetime-local" />
        </UFormField>
        <UFormField label="To">
          <UInput v-model="form.to" type="datetime-local" />
        </UFormField>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <UButton variant="ghost" label="Clear" @click="clearFilters" />
        <UButton label="Apply filters" icon="i-lucide-filter" @click="applyFilters" />
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">Events</h2>
          <UBadge variant="subtle" color="neutral" size="sm"> {{ data?.total ?? 0 }} total </UBadge>
        </div>
      </template>

      <div v-if="status === 'pending'" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <div v-else-if="!data?.items.length" class="py-8 text-center text-sm text-muted">
        No events match your filters.
      </div>

      <ul v-else class="divide-y divide-default">
        <AdminAuditLogRow v-for="item in data.items" :key="item.id" :item="item" />
      </ul>

      <div
        v-if="data && data.total > data.pageSize"
        class="mt-4 flex items-center justify-between border-t border-default pt-4 text-sm"
      >
        <p class="text-muted">Page {{ data.page }} of {{ totalPages }}</p>
        <div class="flex items-center gap-2">
          <UButton
            size="sm"
            variant="ghost"
            icon="i-lucide-chevron-left"
            label="Previous"
            :disabled="data.page <= 1"
            @click="setPage(data.page - 1)"
          />
          <UButton
            size="sm"
            variant="ghost"
            trailing-icon="i-lucide-chevron-right"
            label="Next"
            :disabled="data.page >= totalPages"
            @click="setPage(data.page + 1)"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
