<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'API keys — Camel OS' })

const { can, isAdmin } = await usePermissions()
if (!isAdmin.value && !can.value('admin', 'admin')) {
  throw createError({ statusCode: 403, statusMessage: 'Admin only', fatal: true })
}
const toast = useToast()

interface Key {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}
const { data, refresh } = await useFetch<{ items: Key[] }>('/api/settings/api-keys', {
  key: 'api-keys',
  default: () => ({ items: [] }),
})

const open = ref(false)
const name = ref('')
const creating = ref(false)
const newKey = ref<string | null>(null)
async function create() {
  if (!name.value.trim()) return
  creating.value = true
  try {
    const res = await $fetch<{ key: string }>('/api/settings/api-keys', {
      method: 'POST',
      body: { name: name.value, scopes: ['read'] },
    })
    newKey.value = res.key
    name.value = ''
    await refresh()
  } catch {
    toast.add({ title: 'Could not create key', color: 'error' })
  } finally {
    creating.value = false
  }
}
async function revoke(k: Key) {
  await $fetch(`/api/settings/api-keys/${k.id}`, { method: 'DELETE' }).catch(() => {})
  toast.add({ title: 'Key revoked', color: 'success' })
  await refresh()
}
function copy(v: string) {
  navigator.clipboard?.writeText(v)
  toast.add({ title: 'Copied to clipboard', color: 'success' })
}
const when = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
const origin = import.meta.client ? window.location.origin : ''
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="max-w-2xl">
        <h1 class="text-2xl font-semibold tracking-tight text-default">API keys</h1>
        <p class="mt-1 text-sm text-muted">
          Programmatic access to your organisation's data over the REST API. Treat keys like
          passwords.
        </p>
      </div>
      <UButton icon="i-lucide-plus" label="New key" @click="((open = true), (newKey = null))" />
    </header>

    <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Name</th>
            <th class="px-4 py-2 font-medium">Key</th>
            <th class="hidden px-4 py-2 font-medium md:table-cell">Last used</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="k in data?.items ?? []" :key="k.id">
            <td class="px-4 py-2.5 font-medium text-default">{{ k.name }}</td>
            <td class="px-4 py-2.5">
              <code class="rounded bg-elevated/60 px-1.5 py-0.5 text-xs text-muted"
                >{{ k.keyPrefix }}…</code
              >
            </td>
            <td class="hidden px-4 py-2.5 text-muted md:table-cell">{{ when(k.lastUsedAt) }}</td>
            <td class="px-4 py-2.5">
              <UBadge
                :color="k.revokedAt ? 'error' : 'success'"
                variant="subtle"
                size="xs"
                :label="k.revokedAt ? 'Revoked' : 'Active'"
              />
            </td>
            <td class="px-4 py-2.5 text-right">
              <UButton
                v-if="!k.revokedAt"
                size="xs"
                variant="ghost"
                color="error"
                label="Revoke"
                @click="revoke(k)"
              />
            </td>
          </tr>
          <tr v-if="!(data?.items ?? []).length">
            <td colspan="5" class="px-4 py-8 text-center text-muted">No API keys yet.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <UCard>
      <template #header><h3 class="text-sm font-semibold text-default">Using the API</h3></template>
      <p class="text-sm text-muted">
        Authenticate with a <code class="text-xs">Bearer</code> token:
      </p>
      <pre
        class="mt-2 overflow-x-auto rounded-lg bg-elevated/60 p-3 text-xs text-default"
      ><code>curl {{ origin }}/api/v1/projects \
  -H "Authorization: Bearer &lt;your-api-key&gt;"</code></pre>
    </UCard>

    <UModal v-model:open="open" title="New API key">
      <template #body>
        <div v-if="newKey" class="space-y-3">
          <div class="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
            Copy this key now — it won't be shown again.
          </div>
          <div class="flex items-center gap-2">
            <code
              class="flex-1 overflow-x-auto rounded-lg bg-elevated/60 px-3 py-2 text-xs text-default"
              >{{ newKey }}</code
            >
            <UButton size="sm" icon="i-lucide-copy" aria-label="Copy" @click="copy(newKey)" />
          </div>
        </div>
        <div v-else class="space-y-3">
          <UFormField label="Key name" hint="e.g. Data warehouse sync"
            ><UInput v-model="name" class="w-full" autofocus
          /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="newKey ? 'Done' : 'Cancel'"
            @click="open = false"
          />
          <UButton v-if="!newKey" label="Create key" :loading="creating" @click="create" />
        </div>
      </template>
    </UModal>
  </div>
</template>
