import { z } from 'zod'

/** Shared validation, vocabulary, and RAG maths for Strategy & Goals (S20). */

export type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

const shortText = z.string().trim().max(255)
const optShortText = shortText.optional().nullable()
const optLongText = z.string().trim().max(4000).optional().nullable()
const optDate = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .nullable()
)

export const STRATEGY_STATUSES = [
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
] as const
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number]
export const STRATEGY_STATUS_LABEL: Record<StrategyStatus, string> = {
  not_started: 'Not started',
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
  achieved: 'Achieved',
}
export const STRATEGY_STATUS_COLOR: Record<StrategyStatus, BadgeColor> = {
  not_started: 'neutral',
  on_track: 'success',
  at_risk: 'warning',
  off_track: 'error',
  achieved: 'primary',
}
/** Hex/Tailwind-friendly dot colour for charts and rings. */
export const STRATEGY_RAG_HEX: Record<StrategyStatus, string> = {
  not_started: '#9ca3af',
  on_track: '#22c55e',
  at_risk: '#f59e0b',
  off_track: '#ef4444',
  achieved: '#6366f1',
}

export const KPI_DIRECTIONS = ['increase', 'decrease'] as const
export type KpiDirection = (typeof KPI_DIRECTIONS)[number]

/** KPI progress as a 0–100 percentage of the journey baseline → target. */
export function kpiProgress(
  baseline: number,
  target: number | null,
  current: number,
  direction: KpiDirection
): number {
  if (target == null || target === baseline) return 0
  const pct =
    direction === 'increase'
      ? ((current - baseline) / (target - baseline)) * 100
      : ((baseline - current) / (baseline - target)) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

/** Map a progress percentage to a RAG status. */
export function ragFromProgress(pct: number): StrategyStatus {
  if (pct >= 100) return 'achieved'
  if (pct >= 80) return 'on_track'
  if (pct >= 50) return 'at_risk'
  if (pct > 0) return 'off_track'
  return 'not_started'
}

// ── Schemas ──────────────────────────────────────────────────────────────────
export const objectiveSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  title: shortText.min(1, 'Title is required'),
  description: optLongText,
  theme: optShortText,
  ownerUserId: z.string().uuid().nullish(),
})
export const objectiveUpdateSchema = objectiveSchema.partial().extend({
  manualStatus: z.enum(STRATEGY_STATUSES).nullish(),
})

export const kpiSchema = z.object({
  name: shortText.min(1, 'Name is required'),
  unit: optShortText,
  baseline: z.coerce.number().default(0),
  target: z.coerce.number().nullish(),
  current: z.coerce.number().default(0),
  direction: z.enum(KPI_DIRECTIONS).default('increase'),
})
export const kpiUpdateSchema = kpiSchema.partial()

export const goalSchema = z.object({
  objectiveId: z.string().uuid().nullish(),
  title: shortText.min(1, 'Title is required'),
  description: optLongText,
  department: optShortText,
  ownerUserId: z.string().uuid().nullish(),
  progressPct: z.coerce.number().int().min(0).max(100).default(0),
  status: z.enum(STRATEGY_STATUSES).default('not_started'),
  dueDate: optDate,
})
export const goalUpdateSchema = goalSchema.partial()

export const individualObjectiveSchema = z.object({
  goalId: z.string().uuid(),
  userId: z.string().uuid(),
  title: shortText.min(1, 'Title is required'),
  description: optLongText,
  progressPct: z.coerce.number().int().min(0).max(100).default(0),
  status: z.enum(STRATEGY_STATUSES).default('not_started'),
  dueDate: optDate,
})
export const individualObjectiveUpdateSchema = individualObjectiveSchema
  .partial()
  .omit({ goalId: true, userId: true })

export const checkinSchema = z.object({
  summary: optLongText,
  ragStatus: z.enum(STRATEGY_STATUSES).default('on_track'),
})
