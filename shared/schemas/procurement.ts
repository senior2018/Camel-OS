import { z } from 'zod'

type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

// ── Purchase orders (PR-01/06) ──
export const PO_STATUSES = [
  'draft',
  'approved',
  'committed',
  'received',
  'closed',
  'cancelled',
] as const
export type PoStatus = (typeof PO_STATUSES)[number]
export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  committed: 'Committed',
  received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
}
export const PO_STATUS_COLOR: Record<PoStatus, BadgeColor> = {
  draft: 'neutral',
  approved: 'info',
  committed: 'warning',
  received: 'primary',
  closed: 'success',
  cancelled: 'error',
}

export const createPoSchema = z.object({
  poNumber: z.string().trim().min(1).max(60),
  vendorId: z.string().uuid().nullish(),
  title: z.string().trim().min(1).max(200),
  currency: z.string().trim().length(3).default('USD'),
  budgetCategory: z.string().trim().max(120).nullish(),
  projectId: z.string().uuid().nullish(),
  orderedDate: z.string().trim().nullish(),
  expectedDate: z.string().trim().nullish(),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(300),
        quantity: z.number().min(0).default(1),
        unitPrice: z.number().min(0).default(0),
      })
    )
    .min(1)
    .max(100),
})
export const updatePoStatusSchema = z.object({ status: z.enum(PO_STATUSES) })
export const receiptSchema = z.object({
  receivedDate: z.string().trim().min(1),
  complete: z.boolean().default(true),
  note: z.string().trim().max(500).nullish(),
})

// ── Vendors (PR-02) ──
export const PROC_VENDOR_STATUSES = ['active', 'inactive'] as const
export type ProcVendorStatus = (typeof PROC_VENDOR_STATUSES)[number]
export const createProcVendorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(120).nullish(),
  contactName: z.string().trim().max(160).nullish(),
  contactEmail: z.string().trim().email().max(160).nullish().or(z.literal('')),
  phone: z.string().trim().max(60).nullish(),
  taxId: z.string().trim().max(80).nullish(),
  complianceDocUrl: z.string().trim().url().max(2000).nullish().or(z.literal('')),
  notes: z.string().trim().max(1000).nullish(),
})

// ── RFQ (PR-03) ──
export const RFQ_STATUSES = ['open', 'closed', 'awarded'] as const
export type RfqStatus = (typeof RFQ_STATUSES)[number]
export const RFQ_STATUS_COLOR: Record<RfqStatus, BadgeColor> = {
  open: 'info',
  closed: 'neutral',
  awarded: 'success',
}
export const createRfqSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  dueDate: z.string().trim().nullish(),
  invitedVendors: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
})
export const updateRfqSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullish(),
  dueDate: z.string().trim().nullish(),
  invitedVendors: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  status: z.enum(RFQ_STATUSES).optional(),
  responses: z
    .array(
      z.object({
        vendor: z.string().trim().min(1),
        amount: z.number().min(0),
        note: z.string().trim().max(300).optional(),
      })
    )
    .max(30)
    .optional(),
  awardedVendor: z.string().trim().max(200).nullish(),
})

// ── Contracts (PR-08) ──
export const CONTRACT_STATUSES = ['active', 'expiring', 'expired', 'terminated'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]
export const CONTRACT_STATUS_COLOR: Record<ContractStatus, BadgeColor> = {
  active: 'success',
  expiring: 'warning',
  expired: 'neutral',
  terminated: 'error',
}
export const createContractSchema = z.object({
  vendorId: z.string().uuid().nullish(),
  vendorName: z.string().trim().max(200).nullish(),
  title: z.string().trim().min(1).max(200),
  value: z.number().min(0).nullish(),
  currency: z.string().trim().length(3).default('USD'),
  startDate: z.string().trim().nullish(),
  endDate: z.string().trim().nullish(),
  documentUrl: z.string().trim().url().max(2000).nullish().or(z.literal('')),
  note: z.string().trim().max(1000).nullish(),
})
export const updateContractSchema = createContractSchema
  .partial()
  .extend({ status: z.enum(CONTRACT_STATUSES).optional() })
