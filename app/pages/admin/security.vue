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

// Email diagnostic (Brevo)
const toast = useToast()
const testTo = ref('')
const testing = ref(false)
interface TestResult {
  success: boolean
  to: string
  fromEmail: string
  messageId?: string
  error?: string
}
const testResult = ref<TestResult | null>(null)
async function sendTest() {
  testing.value = true
  testResult.value = null
  try {
    const res = await $fetch<TestResult>('/api/admin/test-email', {
      method: 'POST',
      body: { to: testTo.value || undefined },
    })
    testResult.value = res
    toast.add({
      title: res.success ? 'Test email accepted by Brevo' : 'Brevo rejected the email',
      description: res.success ? `Sent to ${res.to}. Check the inbox (and spam).` : res.error,
      color: res.success ? 'success' : 'error',
    })
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Request failed'
    toast.add({ title: 'Could not run test', description: msg, color: 'error' })
  } finally {
    testing.value = false
  }
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

    <section>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-mail-check" class="size-5 text-primary" />
            <h2 class="font-semibold">Email diagnostics</h2>
          </div>
        </template>

        <p class="mb-3 text-sm text-muted">
          Send a test email to confirm Brevo delivery. The real result is shown — a success here
          means Brevo accepted the message; if it doesn't arrive, check spam and your sender-domain
          authentication.
        </p>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
          <UFormField label="Send to" class="flex-1" hint="defaults to your account email">
            <UInput v-model="testTo" type="email" placeholder="you@example.com" class="w-full" />
          </UFormField>
          <UButton
            icon="i-lucide-send"
            label="Send test email"
            :loading="testing"
            @click="sendTest"
          />
        </div>

        <div
          v-if="testResult"
          class="mt-4 rounded-lg border p-3 text-sm"
          :class="
            testResult.success ? 'border-success/40 bg-success/5' : 'border-error/40 bg-error/5'
          "
        >
          <p class="font-medium" :class="testResult.success ? 'text-success' : 'text-error'">
            {{ testResult.success ? 'Accepted by Brevo' : 'Rejected by Brevo' }}
          </p>
          <p class="mt-1 text-muted">From: {{ testResult.fromEmail }} → To: {{ testResult.to }}</p>
          <p v-if="testResult.messageId" class="text-muted">
            Message ID: {{ testResult.messageId }}
          </p>
          <p v-if="testResult.error" class="text-error">{{ testResult.error }}</p>
        </div>
      </UCard>
    </section>
  </div>
</template>
