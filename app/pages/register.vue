<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'
import type { FetchError } from 'ofetch'

definePageMeta({
  layout: false,
})

const fields: AuthFormField[] = [
  {
    name: 'firstName',
    type: 'text',
    label: 'First Name',
    placeholder: 'First Name',
    required: true,
    size: 'lg',
  },
  {
    name: 'lastName',
    type: 'text',
    label: 'Last Name',
    placeholder: 'Last Name',
    required: true,
    size: 'lg',
  },
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true,
    size: 'lg',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    required: true,
    size: 'lg',
  },
]

const providers = [
  {
    label: 'Google',
    icon: 'devicon:google',
    onClick: () => {
      window.location.href = '/api/auth/google'
    },
  },
]

const schema = z.object({
  firstName: z.string('First name is required').min(2, 'Must be at least 2 characters'),
  lastName: z.string('Last name is required').min(2, 'Must be at least 2 characters'),
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters'),
})

type Schema = z.output<typeof schema>

const toast = useToast()

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    console.log(payload.data)
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: payload.data,
    })

    await navigateTo('/dashboard')
  } catch (error) {
    console.log(error)
    const fetchError = error as FetchError

    if (fetchError.status) {
      toast.add({
        title: 'Registration failed',
        description: fetchError.data?.message || 'An error occurred during registration',
        color: 'error',
      })
    }
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4 min-h-screen">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        :providers="providers"
        title="Welcome back!"
        icon="i-lucide-lock"
        :loading-auto="true"
        @submit="onSubmit"
      >
        <template #description>
          <p class="text-sm">
            Have an account? <ULink to="/login" class="text-primary font-medium">Sign in</ULink>.
          </p>
        </template>
        <template #footer>
          By signing in, you agree to our
          <ULink to="#" class="text-primary font-medium">Terms of Service</ULink>.
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
