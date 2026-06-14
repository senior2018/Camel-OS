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

    <header class="mb-8 border-b pb-4">
      <h1 class="text-2xl font-bold">{{ data.proposal.title }}</h1>
      <p class="mt-1 text-gray-600">
        For: {{ data.proposal.opportunityTitle }}
        <span v-if="data.proposal.opportunityValue">
          · {{ Number(data.proposal.opportunityValue).toLocaleString() }}
          {{ data.proposal.opportunityCurrency }}</span
        >
      </p>
      <p v-if="data.proposal.deadline" class="text-gray-600">
        Deadline: {{ data.proposal.deadline }}
      </p>
      <p v-if="data.proposal.submissionReference" class="text-gray-600">
        Reference: {{ data.proposal.submissionReference }}
      </p>
    </header>

    <section v-for="s in sections" :key="s.id" class="mb-6">
      <h2 class="mb-1 text-lg font-semibold">{{ s.title }}</h2>
      <p v-if="s.body" class="whitespace-pre-wrap">{{ s.body }}</p>
      <p v-else class="italic text-gray-400">—</p>
    </section>

    <p v-if="!sections.length" class="italic text-gray-500">
      This proposal has no in-system sections (it may be authored as uploaded documents).
    </p>
  </div>
</template>

<style scoped>
@media print {
  .no-print {
    display: none;
  }
}
</style>
