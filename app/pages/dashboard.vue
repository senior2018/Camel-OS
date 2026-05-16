<script setup lang="ts">
definePageMeta({
  layout: false,
})

const { user, clear } = useUserSession()

const { data: mfaStatus, refresh: refreshMfa } = await useFetch('/api/auth/mfa/status')

const showDisableModal = ref(false)
const disableCode = ref('')
const disabling = ref(false)
const toast = useToast()

async function logout() {
  await clear()
  await navigateTo('/login')
}

async function disableMfa() {
  disabling.value = true
  try {
    await $fetch('/api/auth/mfa/disable', {
      method: 'POST',
      body: { code: disableCode.value },
    })
    showDisableModal.value = false
    disableCode.value = ''
    await refreshMfa()
    toast.add({ title: 'MFA disabled', description: 'Two-factor authentication has been turned off.', color: 'success' })
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Invalid code.'
    toast.add({ title: 'Failed to disable MFA', description: msg, color: 'error' })
  } finally {
    disabling.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-2xl space-y-4">

      <!-- Main card -->
      <UCard>
        <template #header>
          <div class="space-y-1">
            <h1 class="text-2xl font-semibold">Dashboard</h1>
            <p class="text-sm text-muted">You are signed in as {{ user?.email }}.</p>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">
            This is the protected area for your app. You can build your workspace experience here next.
          </p>
          <UButton color="neutral" variant="soft" label="Logout" @click="logout" />
        </div>
      </UCard>

      <!-- Security card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-shield" class="size-5 text-primary" />
            <h2 class="font-semibold">Security</h2>
          </div>
        </template>

        <div class="divide-y divide-default">
          <!-- MFA row -->
          <div class="flex items-center justify-between py-4 first:pt-0 last:pb-0">
            <div class="space-y-1">
              <p class="text-sm font-medium">Two-factor authentication</p>
              <p class="text-xs text-muted">
                {{ mfaStatus?.mfaEnabled
                  ? 'Your account is protected with an authenticator app.'
                  : 'Add an extra layer of security to your account.' }}
              </p>
            </div>

            <div class="flex items-center gap-3">
              <UBadge
                :color="mfaStatus?.mfaEnabled ? 'success' : 'neutral'"
                :label="mfaStatus?.mfaEnabled ? 'Enabled' : 'Disabled'"
                variant="subtle"
              />

              <UButton
                v-if="!mfaStatus?.mfaEnabled && mfaStatus?.hasLocalAccount"
                size="sm"
                variant="outline"
                label="Set up"
                icon="i-lucide-plus"
                @click="navigateTo('/mfa-setup')"
              />
              <UButton
                v-else-if="mfaStatus?.mfaEnabled"
                size="sm"
                color="error"
                variant="ghost"
                label="Disable"
                icon="i-lucide-shield-off"
                @click="showDisableModal = true"
              />
              <UTooltip
                v-else
                text="MFA is only available for accounts with a password"
              >
                <UButton size="sm" variant="ghost" disabled label="Not available" />
              </UTooltip>
            </div>
          </div>

          <!-- Password row -->
          <div class="flex items-center justify-between py-4 first:pt-0 last:pb-0">
            <div class="space-y-1">
              <p class="text-sm font-medium">Password</p>
              <p class="text-xs text-muted">Change your account password.</p>
            </div>
            <UButton
              size="sm"
              variant="outline"
              label="Change password"
              icon="i-lucide-key"
              @click="navigateTo('/forgot-password')"
            />
          </div>
        </div>
      </UCard>

    </div>

    <!-- Disable MFA modal -->
    <UModal v-model:open="showDisableModal" title="Disable two-factor authentication">
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            description="Disabling MFA will make your account less secure. You can re-enable it at any time."
          />
          <UFormField label="Enter your 6-digit authentication code" name="code">
            <UInput
              v-model="disableCode"
              placeholder="000000"
              maxlength="6"
              autocomplete="one-time-code"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" label="Cancel" @click="showDisableModal = false" />
          <UButton
            color="error"
            label="Disable MFA"
            :loading="disabling"
            :disabled="disableCode.length !== 6"
            @click="disableMfa"
          />
        </div>
      </template>
    </UModal>

  </div>
</template>
