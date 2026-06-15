<script setup lang="ts">
// PM-07 — print/PDF view of a proposal. Opens in its own tab and triggers the
// browser print dialog (Save as PDF). No dashboard chrome.
definePageMeta({ layout: false })

const route = useRoute()
const id = computed(() => route.params.id as string)

interface ProposalDoc {
  title: string
  status: string
  deadline: string | null
  submissionReference: string | null
  opportunityTitle: string
  opportunityValue: string | null
  opportunityCurrency: string
}
interface Section {
  id: string
  title: string
  body: string | null
  sortOrder: number
}

const { data } = await useFetch<{ proposal: ProposalDoc }>(() => `/api/proposals/${id.value}`, {
  key: () => `print-proposal-${id.value}`,
})
const { data: sectionData } = await useFetch<{ sections: Section[] }>(
  () => `/api/proposals/${id.value}/sections`,
  { key: () => `print-sections-${id.value}`, default: () => ({ sections: [] }) }
)
const sections = computed(() => sectionData.value?.sections ?? [])
const generatedAt = new Date().toLocaleDateString(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

useHead({ title: computed(() => `${data.value?.proposal.title ?? 'Proposal'} (print)`) })

function doPrint() {
  window.print()
}
onMounted(() => {
  // Give the DOM a tick to paint, then open the print dialog.
  setTimeout(doPrint, 400)
})
</script>

<template>
  <div v-if="data" class="mx-auto max-w-3xl p-10 text-[13px] leading-relaxed text-black">
    <div class="no-print mb-6 flex justify-end gap-2">
      <button class="rounded border px-3 py-1 text-sm" @click="doPrint">Print / Save PDF</button>
    </div>

    <header class="mb-8 border-b-2 border-black pb-4">
      <p class="text-xs uppercase tracking-widest text-gray-500">Proposal</p>
      <h1 class="mt-1 text-2xl font-bold">{{ data.proposal.title }}</h1>
      <dl class="mt-3 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-gray-700">
        <dt class="font-medium">Opportunity</dt>
        <dd>
          {{ data.proposal.opportunityTitle }}
          <span v-if="data.proposal.opportunityValue">
            · {{ Number(data.proposal.opportunityValue).toLocaleString() }}
            {{ data.proposal.opportunityCurrency }}</span
          >
        </dd>
        <template v-if="data.proposal.deadline">
          <dt class="font-medium">Deadline</dt>
          <dd>{{ data.proposal.deadline }}</dd>
        </template>
        <template v-if="data.proposal.submissionReference">
          <dt class="font-medium">Reference</dt>
          <dd>{{ data.proposal.submissionReference }}</dd>
        </template>
        <dt class="font-medium">Status</dt>
        <dd class="capitalize">{{ data.proposal.status.replace(/_/g, ' ') }}</dd>
      </dl>
    </header>

    <section v-for="(s, i) in sections" :key="s.id" class="section mb-6">
      <h2 class="mb-1.5 text-lg font-semibold">
        <span class="text-gray-400">{{ i + 1 }}.</span> {{ s.title }}
      </h2>
      <p v-if="s.body" class="whitespace-pre-wrap">{{ s.body }}</p>
      <p v-else class="italic text-gray-400">—</p>
    </section>

    <p v-if="!sections.length" class="italic text-gray-500">
      This proposal has no in-system sections (it may be authored as uploaded documents).
    </p>

    <footer class="mt-10 border-t pt-3 text-xs text-gray-500">
      Generated {{ generatedAt }} · Camel OS
    </footer>
  </div>
</template>

<style scoped>
@media print {
  .no-print {
    display: none;
  }
  /* Keep a section's heading with its body across page breaks. */
  .section {
    break-inside: avoid;
  }
}
@page {
  size: A4;
  margin: 18mm;
}
</style>
