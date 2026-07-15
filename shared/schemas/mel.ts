import { z } from 'zod'

/** Shared validation + vocabulary for Monitoring & Evaluation (S16). */

export type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

// Legacy fixed levels — kept only as the fallback vocabulary. Actual levels are
// org-configurable (see DEFAULT_MEL_LEVELS in shared/schemas/project-settings).
export const MEL_LEVELS = ['goal', 'outcome', 'output', 'indicator'] as const
export type MelLevel = (typeof MEL_LEVELS)[number]
export const MEL_LEVEL_LABEL: Record<string, string> = {
  goal: 'Goal',
  outcome: 'Outcome',
  output: 'Output',
  indicator: 'Indicator',
}

export const QUESTION_TYPES = ['text', 'scale', 'multiple_choice'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  text: 'Text',
  scale: 'Scale (1–5)',
  multiple_choice: 'Multiple choice',
}

export const EVALUATION_STATUSES = ['draft', 'open', 'closed'] as const
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number]
export const EVALUATION_STATUS_LABEL: Record<EvaluationStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
}
export const EVALUATION_STATUS_COLOR: Record<EvaluationStatus, BadgeColor> = {
  draft: 'neutral',
  open: 'success',
  closed: 'info',
}

// ME-01 — level is a configurable label (validated as free text; the UI offers
// the org's configured results-framework levels).
export const indicatorSchema = z.object({
  level: z.string().trim().min(1).max(60).default('Indicator'),
  parentId: z.string().uuid().nullish(),
  name: z.string().trim().min(1).max(300),
  baseline: z.number().nullish(),
  target: z.number().nullish(),
  unit: z.string().trim().max(40).nullish(),
  frequency: z.string().trim().max(60).nullish(),
  dataSource: z.string().trim().max(200).nullish(),
  orderIndex: z.number().int().min(0).default(0),
})
export type IndicatorPayload = z.infer<typeof indicatorSchema>

// ME-02
export const dataPointSchema = z.object({
  indicatorId: z.string().uuid(),
  periodDate: z.string().trim().min(1),
  value: z.number(),
  note: z.string().trim().max(1000).nullish(),
  evidenceUrl: z.string().trim().url().max(2000).nullish().or(z.literal('')),
})
export type DataPointPayload = z.infer<typeof dataPointSchema>

// ME-04
export const evaluationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  projectId: z.string().uuid().nullish(),
})
export type EvaluationPayload = z.infer<typeof evaluationSchema>

export const evaluationQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(QUESTION_TYPES),
        prompt: z.string().trim().min(1).max(500),
        options: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
        required: z.boolean().default(false),
      })
    )
    .max(50),
})
export type EvaluationQuestionsPayload = z.infer<typeof evaluationQuestionsSchema>

// Public response (no auth — submitted via the distribution link).
export const evaluationResponseSchema = z.object({
  respondentName: z.string().trim().max(160).nullish(),
  answers: z
    .array(z.object({ questionId: z.string().uuid(), value: z.string().max(4000) }))
    .max(50),
})
export type EvaluationResponsePayload = z.infer<typeof evaluationResponseSchema>

// ME-05
export const lessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullish(),
  sector: z.string().trim().max(80).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  projectId: z.string().uuid().nullish(),
})
export type LessonPayload = z.infer<typeof lessonSchema>
