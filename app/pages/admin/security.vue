<script setup lang="ts">
import type { PasswordPolicy } from '@@/shared/schemas/password-policy'

definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Security — Camel OS' })

const { data, status, savePolicy } = useAdminPasswordPolicy()
const saving = ref(false)

async function handleSubmit(policy: PasswordPolicy) {
  saving.value = true
  await savePolicy(policy)
  saving.value = false
}
</script>

<template>
  <div class="space-y-8">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-default">Security</h1>
      <p class="mt-1 text-sm text-muted">
        Configure organization-wide security policies. Changes apply to every user.
      </p>
    </header>

    <section>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-key" class="size-5 text-primary" />
            <h2 class="font-semibold">Password policy</h2>
          </div>
        </template>

        <div v-if="status === 'pending' || !data?.policy" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <AdminPasswordPolicyForm
          v-else
          :policy="data.policy"
          :submitting="saving"
          @submit="handleSubmit"
        />
      </UCard>
    </section>
  </div>
</template>
