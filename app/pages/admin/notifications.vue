<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Notification rules — Camel OS' })

const toast = useToast()

interface Category {
  key: string
  label: string
  help: string
}
interface Role {
  id: string
  name: string
}
const { data, status } = await useFetch<{
  categories: Category[]
  roles: Role[]
  matrix: Record<string, string[]>
}>('/api/admin/notification-policy', {
  key: 'admin-notification-policy',
  default: () => ({ categories: [], roles: [], matrix: {} }),
})

// Local editable copy of the matrix as a Set per category for quick toggles.
const local = reactive<Record<string, Set<string>>>({})
watchEffect(() => {
  if (!data.value) return
  for (const c of data.value.categories) {
    local[c.key] = new Set(data.value.matrix[c.key] ?? [])
  }
})

function isOn(category: string, roleId: string) {
  const set = local[category]
  // Empty set = unrestricted, so every role is effectively "on".
  return !set || set.size === 0 || set.has(roleId)
}
function isRestricted(category: string) {
  const set = local[category]
  return !!set && set.size > 0
}
function toggle(category: string, roleId: string) {
  const allRoleIds = (data.value?.roles ?? []).map((r) => r.id)
  let set = local[category] ?? new Set<string>()
  if (set.size === 0) {
    // Was unrestricted (everyone). Unchecking one starts an allow-list of all-but-this.
    set = new Set(allRoleIds)
    set.delete(roleId)
  } else if (set.has(roleId)) {
    set.delete(roleId)
  } else {
    set.add(roleId)
  }
  // Selecting every role is the same as no restriction — normalise back to "Everyone".
  if (set.size === allRoleIds.length) set = new Set()
  local[category] = set
}
function clearRestriction(category: string) {
  local[category] = new Set()
}

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    const matrix: Record<string, string[]> = {}
    for (const c of data.value?.categories ?? []) {
      matrix[c.key] = [...(local[c.key] ?? new Set())]
    }
    await $fetch('/api/admin/notification-policy', { method: 'PUT', body: { matrix } })
    toast.add({ title: 'Notification rules saved', color: 'success' })
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="border-b border-default/70 pb-5">
      <h1 class="text-2xl font-semibold tracking-tight text-default">Notification rules</h1>
      <p class="mt-1 max-w-2xl text-sm text-muted">
        Control which roles receive each category of notification (NT-02). A category with no roles
        selected is <strong>unrestricted</strong> — everyone receives it. Select roles to restrict
        delivery to only those roles. This governs both in-app and email delivery; individuals can
        still mute email per category in their own settings.
      </p>
    </header>

    <div v-if="status === 'pending'" class="py-12 text-center text-sm text-muted">Loading…</div>

    <div v-else class="overflow-x-auto rounded-xl border border-default">
      <table class="w-full min-w-160 text-sm">
        <thead>
          <tr class="border-b border-default bg-elevated/40 text-left">
            <th class="p-3 font-medium text-muted">Category</th>
            <th
              v-for="r in data?.roles ?? []"
              :key="r.id"
              class="p-3 text-center font-medium text-muted"
            >
              {{ r.name }}
            </th>
            <th class="p-3 text-center font-medium text-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in data?.categories ?? []"
            :key="c.key"
            class="border-b border-default/60 last:border-0"
          >
            <td class="p-3 align-top">
              <div class="font-medium text-default">{{ c.label }}</div>
              <div class="text-xs text-muted">{{ c.help }}</div>
            </td>
            <td v-for="r in data?.roles ?? []" :key="r.id" class="p-3 text-center">
              <UCheckbox
                :model-value="isOn(c.key, r.id)"
                :disabled="saving"
                @update:model-value="toggle(c.key, r.id)"
              />
            </td>
            <td class="p-3 text-center">
              <UButton
                v-if="isRestricted(c.key)"
                label="Restricted"
                color="warning"
                variant="subtle"
                size="xs"
                trailing-icon="i-lucide-x"
                @click="clearRestriction(c.key)"
              />
              <UBadge v-else label="Everyone" color="neutral" variant="subtle" size="xs" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex justify-end">
      <UButton label="Save rules" :loading="saving" @click="save" />
    </div>
  </div>
</template>
