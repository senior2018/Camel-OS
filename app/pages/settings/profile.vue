<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'My profile — Camel OS' })

const toast = useToast()
const { user, fetch: refreshSession } = useUserSession()

const sessionUser = computed(
  () =>
    user.value as {
      id: string
      email: string
      firstName: string
      lastName: string
    } | null
)

const state = reactive({
  firstName: '',
  lastName: '',
})

watch(
  sessionUser,
  (u) => {
    if (!u) return
    state.firstName = u.firstName ?? ''
    state.lastName = u.lastName ?? ''
  },
  { immediate: true }
)

const submitting = ref(false)

async function save() {
  submitting.value = true
  try {
    await $fetch('/api/me/profile', {
      method: 'PATCH',
      body: { firstName: state.firstName, lastName: state.lastName },
    })
    await refreshSession()
    toast.add({ title: 'Profile updated', color: 'success' })
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Update failed.'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-default">My profile</h1>
      <p class="mt-1 text-sm text-muted">
        Update your name and review the account details on file. Email and security settings live
        under the Security section.
      </p>
    </header>

    <UCard class="max-w-lg">
      <template #header>
        <h3 class="text-sm font-semibold text-default">Account details</h3>
      </template>

      <div class="space-y-4">
        <UFormField label="First name" required>
          <UInput v-model="state.firstName" class="w-full" />
        </UFormField>

        <UFormField label="Last name" required>
          <UInput v-model="state.lastName" class="w-full" />
        </UFormField>

        <UFormField
          label="Email"
          hint="Email changes are administered — contact your workspace admin."
        >
          <UInput :model-value="sessionUser?.email ?? ''" disabled class="w-full" />
        </UFormField>

        <div class="flex justify-end">
          <UButton :loading="submitting" label="Save changes" @click="save" />
        </div>
      </div>
    </UCard>
  </div>
</template>
