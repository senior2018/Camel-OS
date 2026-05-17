<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'
import type { FetchError } from 'ofetch'

definePageMeta({
  layout: 'auth'
})

useHead({ title: 'Create your workspace — Sahara Consult' })

const fields: AuthFormField[] = [
  {
    name: 'firstName',
    type: 'text',
    label: 'First name',
    placeholder: 'Jane',
    required: true,
    size: 'lg'
  },
  {
    name: 'lastName',
    type: 'text',
    label: 'Last name',
    placeholder: 'Doe',
    required: true,
    size: 'lg'
  },
  {
    name: 'email',
    type: 'email',
    label: 'Work email',
    placeholder: 'you@company.com',
    required: true,
    size: 'lg'
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'At least 8 characters',
    required: true,
    size: 'lg'
  }
]

const providers = [
  {
    label: 'Sign up with Google',
    icon: 'devicon:google',
    onClick: () => {
      window.location.href = '/api/auth/google'
    }
  }
]

const schema = z.object({
  firstName: z.string('First name is required').min(2, 'Must be at least 2 characters'),
  lastName: z.string('Last name is required').min(2, 'Must be at least 2 characters'),
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>

const toast = useToast()

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: payload.data
    })

    await navigateTo('/verify-email-sent')
  } catch (error) {
    const fetchError = error as FetchError

    if (fetchError.status) {
      toast.add({
        title: 'Registration failed',
        description: fetchError.data?.statusMessage || 'An error occurred during registration',
        color: 'error'
      })
    }
  }
}
</script>

<template>
  <div>
    <div class="mb-8 text-center lg:text-left">
      <h1 class="text-3xl font-semibold tracking-tight text-default">Create your workspace</h1>
      <p class="mt-2 text-sm text-muted">
        Start your free workspace — no credit card required.
      </p>
    </div>

    <UAuthForm
      :schema="schema"
      :fields="fields"
      :providers="providers"
      :loading-auto="true"
      :submit-button="{ label: 'Create workspace', trailingIcon: 'i-lucide-arrow-right' }"
      @submit="onSubmit"
    />

    <p class="mt-8 text-center text-sm text-muted">
      Already have an account?
      <ULink to="/login" class="font-medium text-primary hover:underline">Sign in</ULink>
    </p>

    <p class="mt-4 text-center text-xs text-muted">
      By creating an account, you agree to our
      <ULink to="#" class="font-medium text-default hover:text-primary">Terms</ULink>
      and
      <ULink to="#" class="font-medium text-default hover:text-primary">Privacy Policy</ULink>.
    </p>
  </div>
</template>
