<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { passwordPolicySchema, type PasswordPolicy } from '@@/shared/schemas/password-policy'

interface Props {
  policy: PasswordPolicy
  submitting?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  submit: [value: PasswordPolicy]
}>()

// Local form state; expiry/history use sentinel "off" toggles so admins can set
// "no expiry" / "no reuse check" without typing 0.
const state = reactive({
  minLength: props.policy.minLength,
  requireUppercase: props.policy.requireUppercase,
  requireLowercase: props.policy.requireLowercase,
  requireNumber: props.policy.requireNumber,
  requireSymbol: props.policy.requireSymbol,
  expiryEnabled: props.policy.expiryDays !== null,
  expiryDays: props.policy.expiryDays ?? 90,
  historyEnabled: props.policy.historyCount > 0,
  historyCount: props.policy.historyCount > 0 ? props.policy.historyCount : 5,
})

watch(
  () => props.policy,
  (next) => {
    state.minLength = next.minLength
    state.requireUppercase = next.requireUppercase
    state.requireLowercase = next.requireLowercase
    state.requireNumber = next.requireNumber
    state.requireSymbol = next.requireSymbol
    state.expiryEnabled = next.expiryDays !== null
    state.expiryDays = next.expiryDays ?? 90
    state.historyEnabled = next.historyCount > 0
    state.historyCount = next.historyCount > 0 ? next.historyCount : 5
  }
)

function onSubmit(_e: FormSubmitEvent<unknown>) {
  emit('submit', {
    minLength: state.minLength,
    requireUppercase: state.requireUppercase,
    requireLowercase: state.requireLowercase,
    requireNumber: state.requireNumber,
    requireSymbol: state.requireSymbol,
    expiryDays: state.expiryEnabled ? state.expiryDays : null,
    historyCount: state.historyEnabled ? state.historyCount : 0,
  })
}
</script>

<template>
  <UForm :schema="passwordPolicySchema" :state="state" @submit="onSubmit">
    <div class="space-y-6">
      <!-- Length -->
      <section class="space-y-3">
        <header>
          <h3 class="text-sm font-semibold text-default">Length</h3>
          <p class="text-xs text-muted">Minimum number of characters required.</p>
        </header>
        <UFormField name="minLength">
          <UInputNumber v-model="state.minLength" :min="8" :max="128" class="w-32" />
        </UFormField>
      </section>

      <USeparator />

      <!-- Character classes -->
      <section class="space-y-3">
        <header>
          <h3 class="text-sm font-semibold text-default">Required character classes</h3>
          <p class="text-xs text-muted">Tighten password complexity for all users.</p>
        </header>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UCheckbox v-model="state.requireUppercase" label="At least one uppercase letter (A–Z)" />
          <UCheckbox v-model="state.requireLowercase" label="At least one lowercase letter (a–z)" />
          <UCheckbox v-model="state.requireNumber" label="At least one number (0–9)" />
          <UCheckbox v-model="state.requireSymbol" label="At least one symbol (!@#$…)" />
        </div>
      </section>

      <USeparator />

      <!-- Expiry -->
      <section class="space-y-3">
        <header class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-default">Password expiry</h3>
            <p class="text-xs text-muted">
              Force users to set a new password after a number of days.
            </p>
          </div>
          <USwitch v-model="state.expiryEnabled" />
        </header>
        <UFormField v-if="state.expiryEnabled" name="expiryDays">
          <div class="flex items-center gap-2">
            <UInputNumber v-model="state.expiryDays" :min="1" :max="3650" class="w-32" />
            <span class="text-sm text-muted">days</span>
          </div>
        </UFormField>
      </section>

      <USeparator />

      <!-- History -->
      <section class="space-y-3">
        <header class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-default">Password history</h3>
            <p class="text-xs text-muted">Prevent users from reusing recent passwords.</p>
          </div>
          <USwitch v-model="state.historyEnabled" />
        </header>
        <UFormField v-if="state.historyEnabled" name="historyCount">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted">Remember the last</span>
            <UInputNumber v-model="state.historyCount" :min="1" :max="24" class="w-32" />
            <span class="text-sm text-muted">password(s)</span>
          </div>
        </UFormField>
      </section>

      <div class="flex justify-end pt-2">
        <UButton
          type="submit"
          :loading="submitting"
          label="Save policy"
          trailing-icon="i-lucide-check"
        />
      </div>
    </div>
  </UForm>
</template>
