<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})

useHead({ title: 'Dashboard — Camel OS' })

const { user } = useUserSession()
const toast = useToast()

const { data: mfaStatus, refresh: refreshMfa } = await useFetch('/api/auth/mfa/status')
const { data: perms } = await usePermissions()

const showDisableModal = ref(false)
const disableCode = ref('')
const disabling = ref(false)

const firstName = computed(() => {
  const u = user.value as { firstName?: string } | null
  return u?.firstName ?? 'there'
})

// S5b — on the super admin's own dashboard, hide the redundant "System
// Administrator" role pill; the gold "Super Administrator" badge replaces it.
const displayDashboardRoles = computed(() => {
  const list = perms.value?.roles ?? []
  if (perms.value?.isSuperAdmin) {
    return list.filter((r: { name: string }) => r.name !== 'System Administrator')
  }
  return list
})

// S5b — copy reflects the actual MFA method instead of always saying "authenticator app".
const mfaDescription = computed(() => {
  if (!mfaStatus.value?.mfaEnabled) {
    return 'Add an extra layer of security to your account.'
  }
  if (mfaStatus.value?.mfaMethod === 'email') {
    return 'You sign in with a 6-digit code sent to your email.'
  }
  return 'You sign in with a code from your authenticator app.'
})

// "Change method" disables MFA first, then routes to setup so the user can pick
// the other method. Reuses the existing disable confirmation flow — they enter
// a current code, MFA flips off, then they re-enroll on /mfa-setup. Simpler
// than building a separate "switch method" flow.
function startChangeMethod() {
  showDisableModal.value = true
  changingMethod.value = true
}
const changingMethod = ref(false)

// Only show actions that are actually wired up. Future modules add items here as they land.
const quickActions = computed(() => {
  const items: Array<{ title: string; description: string; icon: string; to: string }> = []
  if (!mfaStatus.value?.mfaEnabled && mfaStatus.value?.hasLocalAccount) {
    items.push({
      title: 'Set up two-factor authentication',
      description: 'Add a second layer of security to your account.',
      icon: 'i-lucide-shield',
      to: '/mfa-setup',
    })
  }
  return items
})

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
    // S5b — if the user clicked "Change method", route them straight to setup
    // so they can pick the other method. Otherwise stay on the dashboard.
    if (changingMethod.value) {
      changingMethod.value = false
      toast.add({ title: 'Pick a new method', color: 'success' })
      await navigateTo('/mfa-setup')
    } else {
      toast.add({
        title: 'MFA disabled',
        description: 'Two-factor authentication has been turned off.',
        color: 'success',
      })
    }
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Invalid code.'
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
            Sign-in is live. New modules will appear here as they're rolled out.
          </p>
        </div>
        <UBadge variant="subtle" color="success" size="lg">
          <UIcon name="i-lucide-zap" class="size-3.5" />
          <span class="ml-1.5">Workspace active</span>
        </UBadge>
      </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Quick actions (only render when there's something actionable) -->
      <section v-if="quickActions.length" class="lg:col-span-2">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">Recommended next steps</h2>
              <UBadge variant="subtle" color="primary" size="sm" label="Recommended" />
            </div>
          </template>

          <ul class="divide-y divide-default">
            <li
              v-for="action in quickActions"
              :key="action.title"
              class="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <UIcon :name="action.icon" class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-default">{{ action.title }}</p>
                <p class="text-xs text-muted">{{ action.description }}</p>
              </div>
              <UButton
                :to="action.to"
                size="sm"
                variant="outline"
                trailing-icon="i-lucide-arrow-right"
                label="Open"
              />
            </li>
          </ul>
        </UCard>
      </section>

      <!-- Account summary -->
      <section :class="quickActions.length ? '' : 'lg:col-span-3'">
        <UCard :ui="{ body: 'p-6' }">
          <template #header>
            <h2 class="font-semibold">Your account</h2>
          </template>

          <dl class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <dt class="text-muted">Email</dt>
              <dd class="font-medium text-default">{{ user?.email }}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted">Roles</dt>
              <dd class="flex flex-wrap justify-end gap-1">
                <UBadge
                  v-if="perms?.isSuperAdmin"
                  variant="subtle"
                  color="warning"
                  size="sm"
                  icon="i-lucide-crown"
                  label="Super Administrator"
                />
                <UBadge
                  v-for="role in displayDashboardRoles"
                  :key="role.id"
                  variant="subtle"
                  color="primary"
                  size="sm"
                  :label="role.name"
                />
                <span
                  v-if="!perms?.isSuperAdmin && !displayDashboardRoles.length"
                  class="text-xs text-muted"
                  >No roles assigned</span
                >
              </dd>
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
          <div
            class="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="text-sm font-medium text-default">Two-factor authentication</p>
              <p class="mt-1 text-xs text-muted">
                {{ mfaDescription }}
              </p>
            </div>

            <div class="flex items-center gap-3">
              <UBadge
                v-if="mfaStatus?.mfaEnabled && mfaStatus.mfaMethod"
                :color="mfaStatus.mfaMethod === 'email' ? 'info' : 'primary'"
                variant="subtle"
                :icon="mfaStatus.mfaMethod === 'email' ? 'i-lucide-mail' : 'i-lucide-smartphone'"
                :label="mfaStatus.mfaMethod === 'email' ? 'Email codes' : 'Authenticator app'"
              />
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
                variant="outline"
                label="Change method"
                icon="i-lucide-repeat"
                @click="startChangeMethod"
              />
              <UButton
                v-if="mfaStatus?.mfaEnabled"
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

          <div
            class="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="text-sm font-medium text-default">Password</p>
              <p class="mt-1 text-xs text-muted">Change your account password.</p>
            </div>
            <UButton
              size="sm"
              variant="outline"
              label="Change password"
              icon="i-lucide-key"
              @click="navigateTo('/change-password')"
            />
          </div>
        </div>
      </UCard>
    </section>

    <!-- Disable MFA modal -->
    <UModal
      v-model:open="showDisableModal"
      :title="changingMethod ? 'Change MFA method' : 'Disable two-factor authentication'"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            :color="changingMethod ? 'neutral' : 'warning'"
            variant="subtle"
            :icon="changingMethod ? 'i-lucide-info' : 'i-lucide-triangle-alert'"
            :description="
              changingMethod
                ? 'Confirm your current MFA code, then we’ll take you to set up a different method.'
                : 'Disabling MFA will make your account less secure. You can re-enable it at any time.'
            "
          />
          <UFormField
            :label="
              mfaStatus?.mfaMethod === 'email'
                ? 'Enter the 6-digit code from your email'
                : 'Enter your 6-digit authenticator code'
            "
            name="code"
          >
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
          <UButton
            variant="ghost"
            label="Cancel"
            @click="
              () => {
                showDisableModal = false
                changingMethod = false
              }
            "
          />
          <UButton
            :color="changingMethod ? 'primary' : 'error'"
            :label="changingMethod ? 'Continue' : 'Disable MFA'"
            :loading="disabling"
            :disabled="disableCode.length !== 6"
            @click="disableMfa"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
