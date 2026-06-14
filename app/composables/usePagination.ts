import type { Ref, ComputedRef } from 'vue'

/**
 * Client-side pagination over an already-loaded (and usually already-filtered)
 * list. Right-sized for the current data volumes — the list endpoints return the
 * full set, filters run in the browser, and this just windows the result for
 * display. Swap to server-side paging here if a table ever outgrows a few
 * thousand rows.
 *
 * Resets to page 1 whenever the source shrinks below the current page (e.g. a
 * filter narrows the results), so you never land on an empty page.
 */
export function usePagination<T>(source: Ref<T[]> | ComputedRef<T[]>, pageSize = 10) {
  const page = ref(1)
  const total = computed(() => source.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  watch([total, totalPages], () => {
    if (page.value > totalPages.value) page.value = totalPages.value
  })

  const items = computed(() => {
    const start = (page.value - 1) * pageSize
    return source.value.slice(start, start + pageSize)
  })

  // 1-based [from, to] of what's shown, for "Showing 11–20 of 53".
  const range = computed(() => {
    if (total.value === 0) return { from: 0, to: 0 }
    const from = (page.value - 1) * pageSize + 1
    return { from, to: Math.min(page.value * pageSize, total.value) }
  })

  return { page, pageSize, total, totalPages, items, range }
}
