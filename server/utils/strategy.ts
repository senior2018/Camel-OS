import {
  kpiProgress,
  ragFromProgress,
  type KpiDirection,
  type StrategyStatus,
} from '@@/shared/schemas/strategy'

interface KpiLike {
  baseline: string
  target: string | null
  current: string
  direction: KpiDirection
}

/**
 * Derive an objective's progress (mean of its KPI progress) and RAG status.
 * A manual status set by the owner overrides the derived RAG, but progress is
 * always computed from the KPIs so the dashboard ring stays honest.
 */
export function objectiveRag(
  kpis: KpiLike[],
  manualStatus: StrategyStatus | null
): { status: StrategyStatus; progress: number } {
  const progresses = kpis.map((k) =>
    kpiProgress(
      Number(k.baseline),
      k.target != null ? Number(k.target) : null,
      Number(k.current),
      k.direction
    )
  )
  const progress = progresses.length
    ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
    : 0
  const status = manualStatus ?? (kpis.length ? ragFromProgress(progress) : 'not_started')
  return { status, progress }
}
