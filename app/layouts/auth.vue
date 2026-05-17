<script setup lang="ts">
interface Props {
  testimonial?: { quote: string; author: string; role: string }
}

withDefaults(defineProps<Props>(), {
  testimonial: () => ({
    quote: 'Sahara Consult brought our engagements, grants, and impact reporting into one place. Our team ships outcomes faster — and our funders see it in real time.',
    author: 'Amina K.',
    role: 'Program Director'
  })
})
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
      <NuxtLink to="/" class="relative flex items-center gap-2.5">
        <NuxtImg
          src="/logo.png"
          alt="Sahara Consult"
          width="40"
          height="40"
          class="size-9 rounded-lg shrink-0 ring-1 ring-white/30"
        />
        <span class="text-base font-semibold tracking-tight">Sahara Consult</span>
      </NuxtLink>

      <!-- Middle: Headline -->
      <div class="relative">
        <h2 class="text-balance text-3xl font-semibold leading-tight xl:text-4xl">
          The operating platform for impact-driven consulting firms.
        </h2>
        <p class="mt-4 max-w-md text-pretty text-white/85">
          Engagements, grants, and outcomes — together in one secure workspace built for the way modern consulting firms deliver impact.
        </p>
      </div>

      <!-- Bottom: Testimonial -->
      <figure class="relative">
        <blockquote class="text-sm leading-relaxed text-white/90">
          &ldquo;{{ testimonial.quote }}&rdquo;
        </blockquote>
        <figcaption class="mt-4 flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold ring-1 ring-white/20">
            {{ testimonial.author.charAt(0) }}
          </div>
          <div class="text-sm">
            <p class="font-medium">{{ testimonial.author }}</p>
            <p class="text-white/70">{{ testimonial.role }}</p>
          </div>
        </figcaption>
      </figure>
    </aside>

    <!-- Form panel -->
    <main class="flex flex-1 flex-col">
      <!-- Mobile top bar with logo -->
      <header class="flex items-center justify-between border-b border-default px-6 py-4 lg:hidden">
        <NuxtLink to="/" aria-label="Sahara Consult home">
          <AppLogo />
        </NuxtLink>
        <UButton to="/" variant="ghost" color="neutral" size="sm" icon="i-lucide-arrow-left" label="Home" />
      </header>

      <div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-12">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </div>

      <footer class="border-t border-default px-6 py-4 text-center text-xs text-muted lg:text-left">
        <p>© {{ new Date().getFullYear() }} Sahara Consult. All rights reserved.</p>
      </footer>
    </main>
  </div>
</template>
