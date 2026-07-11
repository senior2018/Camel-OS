import { z } from 'zod'

type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

// ── Org budget (FN-01) ──
export const ORG_BUDGET_STATUSES = ['draft', 'active', 'closed'] as const
export type OrgBudgetStatus = (typeof ORG_BUDGET_STATUSES)[number]
export const ORG_BUDGET_STATUS_LABEL: Record<OrgBudgetStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
}
export const ORG_BUDGET_STATUS_COLOR: Record<OrgBudgetStatus, BadgeColor> = {
  draft: 'neutral',
  active: 'success',
  closed: 'warning',
}

export const createBudgetSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  name: z.string().trim().min(1).max(160),
  currency: z.string().trim().length(3).default('USD'),
})
export const updateBudgetSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  status: z.enum(ORG_BUDGET_STATUSES).optional(),
  lines: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(120),
        allocatedAmount: z.number().min(0).default(0),
        note: z.string().trim().max(500).nullish(),
      })
    )
    .max(200)
    .optional(),
})

// ── Expense claims (FN-02) ──
export const EXPENSE_CLAIM_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'paid',
] as const
export type ExpenseClaimStatus = (typeof EXPENSE_CLAIM_STATUSES)[number]
export const EXPENSE_CLAIM_STATUS_LABEL: Record<ExpenseClaimStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
}
export const EXPENSE_CLAIM_STATUS_COLOR: Record<ExpenseClaimStatus, BadgeColor> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'success',
  rejected: 'error',
  paid: 'primary',
}

export const createExpenseClaimSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().max(120).nullish(),
  amount: z.number().min(0),
  currency: z.string().trim().length(3).default('USD'),
  incurredDate: z.string().trim().min(1),
  projectId: z.string().uuid().nullish(),
  receiptUrl: z.string().trim().url().max(2000).nullish().or(z.literal('')),
})
export const expenseClaimDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'paid']),
  decisionNote: z.string().trim().max(500).nullish(),
})

// ── Vendor invoices (FN-03) ──
export const VENDOR_INVOICE_STATUSES = ['pending', 'approved', 'paid'] as const
export type VendorInvoiceStatus = (typeof VENDOR_INVOICE_STATUSES)[number]
export const VENDOR_INVOICE_STATUS_LABEL: Record<VendorInvoiceStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
}
export const VENDOR_INVOICE_STATUS_COLOR: Record<VendorInvoiceStatus, BadgeColor> = {
  pending: 'warning',
  approved: 'info',
  paid: 'success',
}

export const createVendorInvoiceSchema = z.object({
  vendorName: z.string().trim().min(1).max(200),
  invoiceNumber: z.string().trim().min(1).max(120),
  amount: z.number().min(0),
  currency: z.string().trim().length(3).default('USD'),
  invoiceDate: z.string().trim().min(1),
  dueDate: z.string().trim().nullish(),
  poReference: z.string().trim().max(120).nullish(),
  budgetCategory: z.string().trim().max(120).nullish(),
  projectId: z.string().uuid().nullish(),
})
export const updateVendorInvoiceSchema = z.object({
  status: z.enum(VENDOR_INVOICE_STATUSES),
})
