<script setup lang="ts">
// Internal-system auth shell. No marketing copy — just clear branding and a short
// description of what this platform is.
const highlights = [
  { icon: 'i-lucide-briefcase', label: 'Engagement & opportunity management' },
  { icon: 'i-lucide-banknote', label: 'Grant pipelines & disbursement tracking' },
  { icon: 'i-lucide-line-chart', label: 'Impact measurement & reporting' },
  { icon: 'i-lucide-shield-check', label: 'Enterprise-grade security' },
]
</script>

<template>
  <div class="flex min-h-screen bg-default">
    <!-- Brand panel (desktop only) -->
    <aside
      class="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex"
    >
      <!-- Decorative gradient orbs -->
      <div class="pointer-events-none absolute inset-0 opacity-40">
        <div class="absolute -top-32 -left-20 size-96 rounded-full bg-white/15 blur-3xl" />
        <div class="absolute bottom-0 right-0 size-[28rem] rounded-full bg-black/10 blur-3xl" />
      </div>

      <!-- Top: Logo -->
      <div class="relative flex items-center gap-2.5">
        <img
          src="/logo.png"
          alt="Camel OS"
          width="40"
          height="40"
          class="size-9 rounded-lg shrink-0 ring-1 ring-white/30"
        />
        <span class="text-base font-semibold tracking-tight">Camel OS</span>
      </div>

      <!-- Middle: Internal product description -->
      <div class="relative">
        <h2 class="text-balance text-3xl font-semibold leading-tight xl:text-4xl">
          Your firm's operating platform.
        </h2>
        <p class="mt-4 max-w-md text-pretty text-white/85">
          Sign in to access engagements, grants, and impact tools — all under one secure workspace.
        </p>

        <ul class="mt-8 space-y-3">
          <li
            v-for="h in highlights"
            :key="h.label"
            class="flex items-center gap-3 text-sm text-white/90"
          >
            <span
              class="flex size-7 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20"
            >
              <UIcon :name="h.icon" class="size-4" />
            </span>
            {{ h.label }}
          </li>
        </ul>
      </div>

      <!-- Bottom: Internal note -->
      <p class="relative text-xs text-white/70">
        Internal use only · Access provisioned by your administrator
      </p>
    </aside>

    <!-- Form panel -->
    <main class="flex flex-1 flex-col">
      <!-- Mobile top bar with logo -->
      <header class="flex items-center border-b border-default px-6 py-4 lg:hidden">
        <AppLogo />
      </header>

      <div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-12">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </div>

      <footer class="border-t border-default px-6 py-4 text-center text-xs text-muted lg:text-left">
        <p>© {{ new Date().getFullYear() }} Camel OS · Internal use only</p>
      </footer>
    </main>
  </div>
</template>
