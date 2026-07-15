import type { AuditLogFilters } from '@@/shared/schemas/audit-log'

export interface AuditLogItem {
  id: string
  createdAt: string
  resource: string
  action: string
  resourceId: string | null
  meta: unknown
  userId: string | null
  userEmail: string | null
  userFirstName: string | null
  userLastName: string | null
}

interface AuditLogResponse {
  items: AuditLogItem[]
  total: number
  page: number
  pageSize: number
}

/**
 * Loads a filtered, paginated slice of  audit log and exposes a `downloadCsv`
 * helper that re-uses the same filters server-side.
 */
export function useAdminAuditLog(filters: Ref<Partial<AuditLogFilters>>) {
  const toast = useToast()

  const query = computed(() => {
    const q: Record<string, string | number> = {
      page: filters.value.page ?? 1,
      pageSize: filters.value.pageSize ?? 50,
    }
    if (filters.value.userId) q.userId = filters.value.userId
    if (filters.value.resource) q.resource = filters.value.resource
    if (filters.value.action) q.action = filters.value.action
    if (filters.value.from) q.from = filters.value.from
    if (filters.value.to) q.to = filters.value.to
    return q
  })

  const { data, refresh, status } = useFetch<AuditLogResponse>('/api/admin/audit-log', {
    key: 'admin-audit-log',
    query,
    default: () => ({ items: [], total: 0, page: 1, pageSize: 50 }),
  })

  async function downloadCsv() {
    try {
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(query.value)) {
        params.set(k, String(v))
      }
      const blob = await $fetch<Blob>(`/api/admin/audit-log/export?${params.toString()}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      const msg =
        (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
        'Could not export audit log.'
      toast.add({ title: 'Export failed', description: msg, color: 'error' })
    }
  }

  return { data, status, refresh, downloadCsv }
}
