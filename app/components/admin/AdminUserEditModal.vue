<script setup lang="ts">
import type { AdminUser } from '@/composables/useAdminUsers'

interface Props {
  user: AdminUser | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const open = computed({
  get: () => !!props.user,
  set: (v) => {
    if (!v) emit('close')
  },
})

const state = reactive({
  firstName: '',
  lastName: '',
  email: '',
  mfaRequired: false,
})

const submitting = ref(false)

watch(
  () => props.user,
  (u) => {
    if (!u) return
    state.firstName = u.firstName
    state.lastName = u.lastName
    state.email = u.email
    state.mfaRequired = !!(u as AdminUser & { mfaRequired?: boolean }).mfaRequired
    // Clear any prior reset state when re-opening on a different user.
    resetMode.value = 'email_link'
    issuedTempPassword.value = null
    sentToEmail.value = null
    confirmReset.value = false
  },
  { immediate: true }
)

async function save() {
  if (!props.user) return
  submitting.value = true
  try {
    await $fetch(`/api/admin/users/${props.user.id}`, {
      method: 'PATCH',
      body: {
        firstName: state.firstName,
        lastName: state.lastName,
        email: state.email,
        mfaRequired: state.mfaRequired,
      },
    })
    toast.add({ title: 'User updated', color: 'success' })
    emit('saved')
    emit('close')
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Update failed.'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}

// S7 — Admin password reset. Default mode is `email_link` (recommended): the
// user receives a one-time reset URL and chooses their own password — the admin
// never sees it. The `auto` fallback generates a temp password to hand off in
// person when email is unreliable.
type ResetMode = 'email_link' | 'auto'
const showReset = ref(false)
const resetMode = ref<ResetMode>('email_link')
const resetting = ref(false)
const issuedTempPassword = ref<string | null>(null)
const sentToEmail = ref<string | null>(null)
const confirmReset = ref(false)

function openReset() {
  showReset.value = true
  confirmReset.value = false
  issuedTempPassword.value = null
  sentToEmail.value = null
  resetMode.value = 'email_link'
}

async function doReset() {
  if (!props.user) return
  resetting.value = true
  try {
    const res = await $fetch<
      | { success: boolean; mode: 'email_link'; sentToEmail: string }
      | { success: boolean; mode: 'auto'; tempPassword: string; mustChangePassword: boolean }
    >(`/api/admin/users/${props.user.id}/reset-password`, {
      method: 'POST',
      body: { mode: resetMode.value },
    })
    if (res.mode === 'email_link') {
      sentToEmail.value = res.sentToEmail
      toast.add({
        title: 'Reset link sent',
        description: `The user will receive an email at ${res.sentToEmail}.`,
        color: 'success',
      })
    } else {
      issuedTempPassword.value = res.tempPassword
      toast.add({
        title: 'Temporary password set',
        description: 'User will be forced to change it on next login.',
        color: 'success',
      })
    }
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Reset failed.'
    toast.add({ title: 'Could not reset', description: msg, color: 'error' })
  } finally {
    resetting.value = false
  }
}

function copyTemp() {
  if (!issuedTempPassword.value) return
  navigator.clipboard.writeText(issuedTempPassword.value).then(() => {
    toast.add({ title: 'Copied', color: 'success' })
  })
}

function closeReset() {
  showReset.value = false
  issuedTempPassword.value = null
  sentToEmail.value = null
}

const resetDone = computed(() => !!issuedTempPassword.value || !!sentToEmail.value)
</script>

<template>
  <UModal v-model:open="open" title="Edit user">
    <template #body>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField label="First name" required>
          <UInput v-model="state.firstName" class="w-full" />
        </UFormField>
        <UFormField label="Last name" required>
          <UInput v-model="state.lastName" class="w-full" />
        </UFormField>
        <UFormField label="Email" required class="sm:col-span-2">
          <UInput v-model="state.email" type="email" class="w-full" />
        </UFormField>
        <UCheckbox
          v-model="state.mfaRequired"
          label="Require MFA on this user's account"
          class="sm:col-span-2"
        />
      </div>

      <div class="mt-6 rounded-lg border border-default bg-elevated/40 p-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-default">Reset password</p>
            <p class="text-xs text-muted">
              Send the user a one-time reset link by email, or generate a temporary password as
              fallback.
            </p>
          </div>
          <UButton
            size="sm"
            variant="outline"
            color="warning"
            icon="i-lucide-key-round"
            label="Reset password"
            @click="openReset"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="ml-auto flex gap-3">
        <UButton variant="ghost" label="Cancel" @click="emit('close')" />
        <UButton :loading="submitting" label="Save changes" @click="save" />
      </div>
    </template>
  </UModal>

  <UModal v-model:open="showReset" title="Reset password">
    <template #body>
      <div v-if="!resetDone" class="space-y-4 text-sm">
        <p class="text-muted">
          Pick how to deliver the reset to <b>{{ user?.email }}</b
          >. The email-link option is recommended — the user sets their own password and you never
          see it.
        </p>

        <div class="space-y-2">
          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border border-default p-3 transition-colors hover:border-primary/40"
            :class="resetMode === 'email_link' ? 'border-primary bg-primary/5' : ''"
          >
            <input v-model="resetMode" type="radio" value="email_link" class="mt-1" />
            <div class="flex-1">
              <div class="flex items-center gap-2 font-medium text-default">
                <UIcon name="i-lucide-mail" class="size-4 text-primary" />
                Email a reset link
                <UBadge variant="subtle" color="success" size="xs" label="Recommended" />
              </div>
              <p class="mt-0.5 text-xs text-muted">
                Sends a one-hour single-use link. The user clicks it and chooses their own password
                — the admin never sees it. Best for almost every case.
              </p>
            </div>
          </label>

          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border border-default p-3 transition-colors hover:border-primary/40"
            :class="resetMode === 'auto' ? 'border-primary bg-primary/5' : ''"
          >
            <input v-model="resetMode" type="radio" value="auto" class="mt-1" />
            <div class="flex-1">
              <div class="flex items-center gap-2 font-medium text-default">
                <UIcon name="i-lucide-key-round" class="size-4 text-warning" />
                Generate a temporary password
              </div>
              <p class="mt-0.5 text-xs text-muted">
                Use when the user has lost email access. We generate a password, show it once, and
                force the user to change it at next login.
              </p>
            </div>
          </label>
        </div>

        <UAlert
          v-if="resetMode === 'auto'"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="You'll see the temporary password"
          description="Hand it over via a secure channel — it is shown once after you confirm."
        />

        <UCheckbox
          v-model="confirmReset"
          label="I understand this overrides the user's current password."
        />
      </div>

      <div v-else-if="sentToEmail" class="space-y-3 text-sm">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-mail-check"
          title="Reset link sent"
          :description="`${sentToEmail} will receive a one-hour reset link. They can use it once.`"
        />
      </div>

      <div v-else-if="issuedTempPassword" class="space-y-3 text-sm">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          title="Temporary password set"
          description="The user must change it on next login. Share the password below — it is shown only once."
        />
        <div class="flex items-center gap-2 rounded-md border border-default bg-default p-3">
          <code class="flex-1 font-mono text-sm text-default">{{ issuedTempPassword }}</code>
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-copy"
            aria-label="Copy"
            @click="copyTemp"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="ml-auto flex gap-3">
        <template v-if="!resetDone">
          <UButton variant="ghost" label="Cancel" @click="showReset = false" />
          <UButton
            :color="resetMode === 'auto' ? 'warning' : 'primary'"
            :icon="resetMode === 'email_link' ? 'i-lucide-mail' : 'i-lucide-key-round'"
            :loading="resetting"
            :disabled="!confirmReset"
            :label="resetMode === 'email_link' ? 'Send reset link' : 'Generate password'"
            @click="doReset"
          />
        </template>
        <template v-else>
          <UButton label="Done" @click="closeReset" />
        </template>
      </div>
    </template>
  </UModal>
</template>
