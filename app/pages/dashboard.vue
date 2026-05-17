<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

useHead({ title: 'Dashboard — Camel OS' })

const { user } = useUserSession()
const toast = useToast()

const { data: mfaStatus, refresh: refreshMfa } = await useFetch('/api/auth/mfa/status')

const showDisableModal = ref(false)
const disableCode = ref('')
const disabling = ref(false)

const firstName = computed(() => {
  const u = user.value as { firstName?: string } | null
  return u?.firstName ?? 'there'
})

const stats = [
  { label: 'Active engagements', value: '—', icon: 'i-lucide-briefcase', hint: 'Available soon' },
  { label: 'Open grant cycles', value: '—', icon: 'i-lucide-banknote', hint: 'Available soon' },
  { label: 'Team members', value: '1', icon: 'i-lucide-users', hint: 'Just you for now' },
  { label: 'Impact records', value: '—', icon: 'i-lucide-line-chart', hint: 'Available soon' }
]

const quickActions = [
  { title: 'Set up two-factor auth', description: 'Add a second layer of security to your account.', icon: 'i-lucide-shield', to: '/mfa-setup', disabled: false, hideIf: () => mfaStatus.value?.mfaEnabled },
  { title: 'Invite teammates', description: 'Bring your colleagues into the workspace.', icon: 'i-lucide-user-plus', to: '#', disabled: true },
  { title: 'Create your first engagement', description: 'Start tracking a project from end to end.', icon: 'i-lucide-plus-circle', to: '#', disabled: true }
]

const visibleQuickActions = computed(() =>
  quickActions.filter((a) => !a.hideIf?.())
)

async function disableMfa() {
  disabling.value = true
  try {
    await $fetch('/api/auth/mfa/disable', {
      method: 'POST',
      body: { code: disableCode.value }
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
  <div class="space-y-8">
    <!-- Welcome header -->
    <section>
      <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-default sm:text-3xl">
            Welcome back, <span class="text-primary">{{ firstName }}</span>
          </h1>
          <p class="mt-1 text-sm text-muted">
            Here's a snapshot of your workspace. Modules unlock as the platform rolls out.
          </p>
        </div>
        <UBadge variant="subtle" color="success" size="lg">
          <UIcon name="i-lucide-zap" class="size-3.5" />
          <span class="ml-1.5">Workspace active</span>
        </UBadge>
      </div>
    </section>

    <!-- Stats -->
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard
        v-for="stat in stats"
        :key="stat.label"
        :ui="{ body: 'p-5' }"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-muted">{{ stat.label }}</p>
            <p class="mt-2 text-2xl font-semibold text-default">{{ stat.value }}</p>
          </div>
          <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon :name="stat.icon" class="size-5" />
          </div>
        </div>
        <p class="mt-3 text-xs text-muted">{{ stat.hint }}</p>
      </UCard>
    </section>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Quick actions -->
      <section v-if="visibleQuickActions.length" class="lg:col-span-2">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">Quick actions</h2>
              <UBadge variant="subtle" color="primary" size="sm" label="Recommended" />
            </div>
          </template>

          <ul class="divide-y divide-default">
            <li
              v-for="action in visibleQuickActions"
              :key="action.title"
              class="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon :name="action.icon" class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-default">{{ action.title }}</p>
                <p class="text-xs text-muted">{{ action.description }}</p>
              </div>
              <UButton
                v-if="!action.disabled"
                :to="action.to"
                size="sm"
                variant="outline"
                trailing-icon="i-lucide-arrow-right"
                label="Open"
              />
              <UBadge v-else variant="subtle" color="neutral" size="sm" label="Soon" />
            </li>
          </ul>
        </UCard>
      </section>

      <!-- Workspace info -->
      <section :class="visibleQuickActions.length ? '' : 'lg:col-span-3'">
        <UCard :ui="{ body: 'p-6' }">
          <template #header>
            <h2 class="font-semibold">Your account</h2>
          </template>

          <dl class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <dt class="text-muted">Email</dt>
              <dd class="font-medium text-default">{{ user?.email }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted">Plan</dt>
              <dd><UBadge variant="subtle" color="primary" size="sm" label="Free" /></dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted">Two-factor auth</dt>
              <dd>
                <UBadge
                  :color="mfaStatus?.mfaEnabled ? 'success' : 'neutral'"
                  variant="subtle"
                  size="sm"
                  :label="mfaStatus?.mfaEnabled ? 'Enabled' : 'Disabled'"
                />
              </dd>
            </div>
          </dl>
        </UCard>
      </section>
    </div>

    <!-- Security section -->
    <section id="security">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-shield" class="size-5 text-primary" />
            <h2 class="font-semibold">Security</h2>
          </div>
        </template>

        <div class="divide-y divide-default">
          <div class="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-medium text-default">Two-factor authentication</p>
              <p class="mt-1 text-xs text-muted">
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
              <UTooltip v-else text="MFA requires a password-based account">
                <UButton size="sm" variant="ghost" disabled label="Not available" />
              </UTooltip>
            </div>
          </div>

          <div class="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-medium text-default">Password</p>
              <p class="mt-1 text-xs text-muted">Change your account password.</p>
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
    </section>

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
