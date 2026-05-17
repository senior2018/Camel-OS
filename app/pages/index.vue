<script setup lang="ts">
useHead({
  title: 'Sahara Consult — The operating platform for impact-driven consulting',
  meta: [
    {
      name: 'description',
      content:
        'Run engagements, manage grants, and prove impact from a single secure platform built for modern consulting firms.'
    }
  ]
})

const features = [
  {
    icon: 'i-lucide-briefcase',
    title: 'Engagement workspace',
    description:
      'Plan, staff, and bill every engagement from a unified workspace. Real-time utilization, scope, and burn — without spreadsheets.'
  },
  {
    icon: 'i-lucide-banknote',
    title: 'Grant program management',
    description:
      'Track grant applications, milestones, disbursements, and reporting against funder requirements end-to-end.'
  },
  {
    icon: 'i-lucide-line-chart',
    title: 'Impact measurement',
    description:
      'Capture outcomes against targets, run M&E workflows, and produce funder-ready reports in minutes, not weeks.'
  },
  {
    icon: 'i-lucide-users',
    title: 'Multi-tenant by design',
    description:
      'Isolate clients, partners, and programs with org-level data boundaries and granular role-based access.'
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Enterprise-grade security',
    description:
      'Argon2id passwords, encrypted MFA secrets, hash-chained audit log, and account lockout protection out of the box.'
  },
  {
    icon: 'i-lucide-workflow',
    title: 'Built for collaboration',
    description:
      'Invite teammates, assign roles, comment on records, and keep stakeholders aligned — across geographies and time zones.'
  }
]

const stats = [
  { value: '70+', label: 'Partner organizations' },
  { value: '500k+', label: 'People reached' },
  { value: '12', label: 'Countries served' },
  { value: '99.9%', label: 'Platform uptime' }
]

const solutions = [
  {
    icon: 'i-lucide-building-2',
    title: 'For consulting firms',
    description:
      'A single source of truth across engagements, finances, and client deliverables.',
    bullets: ['Resource planning', 'Time & billing', 'Client portals']
  },
  {
    icon: 'i-lucide-globe-2',
    title: 'For grant programs',
    description:
      'Manage grant pipelines, applications, and impact tracking with funder-grade controls.',
    bullets: ['Application workflows', 'Disbursement tracking', 'Compliance reports']
  },
  {
    icon: 'i-lucide-graduation-cap',
    title: 'For development orgs',
    description:
      'Run programs that deliver measurable outcomes — and prove them to funders.',
    bullets: ['M&E frameworks', 'Beneficiary tracking', 'Funder dashboards']
  }
]

const steps = [
  {
    n: '01',
    title: 'Connect your workspace',
    description: 'Invite your team, set up roles, and bring your engagements and programs into Sahara Consult.'
  },
  {
    n: '02',
    title: 'Run your operations',
    description: 'Plan resources, track grant pipelines, and capture outcomes from day-to-day work.'
  },
  {
    n: '03',
    title: 'Report your impact',
    description: 'Generate funder-ready reports and dashboards that turn data into measurable impact.'
  }
]
</script>

<template>
  <main>
    <!-- ───────── Hero ───────── -->
    <section class="relative overflow-hidden">
      <!-- Background accents -->
      <div class="pointer-events-none absolute inset-0 -z-10">
        <div class="absolute -top-24 left-1/2 size-160 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div class="absolute right-0 top-1/3 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div class="mx-auto max-w-3xl text-center">
          <UBadge variant="subtle" color="primary" size="lg" class="mb-6">
            <UIcon name="i-lucide-sparkles" class="size-3.5" />
            <span class="ml-1.5">The operating platform for consulting firms</span>
          </UBadge>

          <h1 class="text-balance text-4xl font-semibold tracking-tight text-default sm:text-5xl lg:text-6xl">
            Turn community challenges into
            <span class="text-primary">measurable impact</span>
          </h1>

          <p class="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted">
            Run engagements, manage grants, and prove outcomes from a single secure platform —
            purpose-built for impact-driven consulting and development organizations.
          </p>

          <div class="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <UButton
              to="/register"
              size="xl"
              trailing-icon="i-lucide-arrow-right"
              label="Get started — it's free"
            />
            <UButton
              to="/login"
              size="xl"
              variant="ghost"
              color="neutral"
              label="Sign in to your workspace"
            />
          </div>

          <p class="mt-6 text-sm text-muted">
            No credit card required · Free for small teams · SSO &amp; MFA available
          </p>
        </div>

        <!-- Product mockup placeholder -->
        <div class="relative mx-auto mt-16 max-w-5xl">
          <div class="rounded-2xl border border-default bg-elevated/60 p-2 shadow-xl backdrop-blur">
            <div class="rounded-xl bg-default ring-1 ring-default">
              <div class="flex items-center gap-2 border-b border-default px-4 py-3">
                <span class="size-2.5 rounded-full bg-error/60" />
                <span class="size-2.5 rounded-full bg-warning/60" />
                <span class="size-2.5 rounded-full bg-success/60" />
                <span class="ml-3 text-xs text-muted">consult.saharaventures.com</span>
              </div>
              <div class="grid gap-4 p-6 sm:grid-cols-3">
                <div
                  v-for="stat in stats"
                  :key="stat.label"
                  class="rounded-lg bg-elevated/50 p-4"
                >
                  <p class="text-2xl font-semibold text-default">{{ stat.value }}</p>
                  <p class="mt-1 text-xs text-muted">{{ stat.label }}</p>
                </div>
                <div class="sm:col-span-3 grid grid-cols-3 gap-3">
                  <div v-for="i in 3" :key="i" class="h-24 rounded-lg bg-elevated/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── Trust strip ───────── -->
    <section class="border-y border-default bg-elevated/30">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p class="text-center text-sm font-medium text-muted">
          Trusted by consulting firms working with leading funders
        </p>
        <div class="mt-6 grid grid-cols-2 items-center gap-8 opacity-60 sm:grid-cols-3 lg:grid-cols-6">
          <div v-for="i in 6" :key="i" class="flex items-center justify-center">
            <div class="h-7 w-28 rounded bg-muted" />
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── Features ───────── -->
    <section id="platform" class="py-20 lg:py-28">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl text-center">
          <p class="text-sm font-semibold uppercase tracking-wide text-primary">Platform</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight text-default sm:text-4xl">
            Everything your firm runs on, in one place
          </h2>
          <p class="mt-4 text-pretty text-muted">
            Sahara Consult brings engagements, grants, and impact under a single roof — so your teams
            spend less time on spreadsheets and more time on outcomes.
          </p>
        </div>

        <div class="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <UCard
            v-for="feature in features"
            :key="feature.title"
            class="group transition-all hover:-translate-y-0.5 hover:shadow-lg"
            :ui="{ body: 'p-6' }"
          >
            <div class="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-inverted">
              <UIcon :name="feature.icon" class="size-5" />
            </div>
            <h3 class="mt-5 text-lg font-semibold text-default">{{ feature.title }}</h3>
            <p class="mt-2 text-sm text-muted">{{ feature.description }}</p>
          </UCard>
        </div>
      </div>
    </section>

    <!-- ───────── Solutions ───────── -->
    <section id="solutions" class="bg-elevated/30 py-20 lg:py-28">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl text-center">
          <p class="text-sm font-semibold uppercase tracking-wide text-primary">Solutions</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight text-default sm:text-4xl">
            Built for the way you work
          </h2>
          <p class="mt-4 text-pretty text-muted">
            Whether you're a consulting firm, a grant program, or a development organization —
            Sahara Consult adapts to how your teams deliver impact.
          </p>
        </div>

        <div class="mt-16 grid gap-6 lg:grid-cols-3">
          <UCard
            v-for="s in solutions"
            :key="s.title"
            class="transition-all hover:-translate-y-0.5 hover:shadow-lg"
            :ui="{ body: 'p-6' }"
          >
            <div class="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UIcon :name="s.icon" class="size-5" />
            </div>
            <h3 class="mt-5 text-lg font-semibold text-default">{{ s.title }}</h3>
            <p class="mt-2 text-sm text-muted">{{ s.description }}</p>
            <ul class="mt-4 space-y-2">
              <li v-for="b in s.bullets" :key="b" class="flex items-center gap-2 text-sm text-default">
                <UIcon name="i-lucide-check" class="size-4 text-primary" />
                {{ b }}
              </li>
            </ul>
          </UCard>
        </div>
      </div>
    </section>

    <!-- ───────── How it works ───────── -->
    <section id="impact" class="py-20 lg:py-28">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl text-center">
          <p class="text-sm font-semibold uppercase tracking-wide text-primary">How it works</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight text-default sm:text-4xl">
            From sign-up to impact in three steps
          </h2>
        </div>

        <div class="mt-16 grid gap-8 md:grid-cols-3">
          <div
            v-for="step in steps"
            :key="step.n"
            class="relative rounded-2xl border border-default bg-default p-6"
          >
            <span class="text-3xl font-semibold text-primary/40">{{ step.n }}</span>
            <h3 class="mt-3 text-lg font-semibold text-default">{{ step.title }}</h3>
            <p class="mt-2 text-sm text-muted">{{ step.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── CTA ───────── -->
    <section id="pricing" class="pb-24">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 sm:px-16">
          <div class="pointer-events-none absolute inset-0 opacity-30">
            <div class="absolute -right-20 -top-20 size-80 rounded-full bg-white/20 blur-3xl" />
            <div class="absolute -bottom-20 -left-20 size-80 rounded-full bg-white/10 blur-3xl" />
          </div>

          <div class="relative mx-auto max-w-3xl text-center">
            <h2 class="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to put your firm's operations on autopilot?
            </h2>
            <p class="mt-4 text-pretty text-white/90">
              Spin up a workspace in minutes. Bring your team. Start delivering measurable impact.
            </p>
            <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <UButton
                to="/register"
                size="xl"
                color="neutral"
                trailing-icon="i-lucide-arrow-right"
                label="Create your workspace"
                class="bg-white text-primary hover:bg-white/90"
              />
              <UButton
                to="/login"
                size="xl"
                color="neutral"
                variant="ghost"
                label="Sign in"
                class="text-white hover:bg-white/10"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
