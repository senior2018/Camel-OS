<script setup lang="ts">
import { ACTIONS, MODULES, type PermissionAction } from '@@/shared/permissions'

interface PermissionTuple {
  module: string
  action: PermissionAction
}

interface Props {
  modelValue: PermissionTuple[]
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: PermissionTuple[]]
}>()

// S5b  hide the wildcard `admin` action from the matrix; it duplicates what
// the "All" column already does for the user. Admin stays in the underlying
// data model (the System Administrator role still has it via the seed), but
// admins editing other roles only see the four explicit actions.
const VISIBLE_ACTIONS = ACTIONS.filter((a) => a !== 'admin')

// Index permissions by `${module}:${action}` for O(1) checkbox lookup.
const granted = computed(() => {
  const set = new Set<string>()
  for (const p of props.modelValue) set.add(`${p.module}:${p.action}`)
  return set
})

function isChecked(moduleKey: string, action: PermissionAction) {
  return granted.value.has(`${moduleKey}:${action}`)
}

function toggle(moduleKey: string, action: PermissionAction) {
  if (props.disabled) return
  const key = `${moduleKey}:${action}`
  const next = props.modelValue.filter((p) => `${p.module}:${p.action}` !== key)
  if (next.length === props.modelValue.length) {
    next.push({ module: moduleKey, action })
  }
  emit('update:modelValue', next)
}

function toggleAllForModule(moduleKey: string) {
  if (props.disabled) return
  const allChecked = VISIBLE_ACTIONS.every((a) => granted.value.has(`${moduleKey}:${a}`))
  const cleared = props.modelValue.filter((p) => p.module !== moduleKey)
  if (allChecked) {
    emit('update:modelValue', cleared)
  } else {
    emit('update:modelValue', [
      ...cleared,
      ...VISIBLE_ACTIONS.map((action) => ({ module: moduleKey, action })),
    ])
  }
}

function moduleHasAny(moduleKey: string) {
  return VISIBLE_ACTIONS.some((a) => granted.value.has(`${moduleKey}:${a}`))
}

function moduleHasAll(moduleKey: string) {
  return VISIBLE_ACTIONS.every((a) => granted.value.has(`${moduleKey}:${a}`))
}
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <table class="w-full text-sm">
      <thead class="bg-elevated/50 text-left">
        <tr>
          <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Module
          </th>
          <th
            v-for="action in VISIBLE_ACTIONS"
            :key="action"
            class="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted"
          >
            {{ action }}
          </th>
          <th
            class="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted"
          >
            All
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr
          v-for="mod in MODULES"
          :key="mod.key"
          :class="moduleHasAny(mod.key) ? 'bg-primary/[0.02]' : ''"
        >
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <UIcon :name="mod.icon" class="size-4" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-default">{{ mod.label }}</p>
                <p class="truncate text-xs text-muted">{{ mod.description }}</p>
              </div>
            </div>
          </td>
          <td v-for="action in VISIBLE_ACTIONS" :key="action" class="px-3 py-3 text-center">
            <UCheckbox
              :model-value="isChecked(mod.key, action)"
              :disabled="disabled"
              @update:model-value="toggle(mod.key, action)"
            />
          </td>
          <td class="px-3 py-3 text-center">
            <UCheckbox
              :model-value="moduleHasAll(mod.key)"
              :indeterminate="moduleHasAny(mod.key) && !moduleHasAll(mod.key)"
              :disabled="disabled"
              @update:model-value="toggleAllForModule(mod.key)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
