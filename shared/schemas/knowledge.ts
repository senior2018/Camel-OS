import { z } from 'zod'

type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

export const KNOWLEDGE_KINDS = ['article', 'help'] as const
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number]

export const KNOWLEDGE_STATUSES = ['draft', 'published', 'archived'] as const
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number]
export const KNOWLEDGE_STATUS_LABEL: Record<KnowledgeStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}
export const KNOWLEDGE_STATUS_COLOR: Record<KnowledgeStatus, BadgeColor> = {
  draft: 'neutral',
  published: 'success',
  archived: 'warning',
}

export const KNOWLEDGE_VISIBILITIES = ['everyone', 'restricted'] as const
export type KnowledgeVisibility = (typeof KNOWLEDGE_VISIBILITIES)[number]

// Route/module keys a help doc can be pinned to for the contextual panel (HD-02).
export const CONTEXT_KEYS = [
  'opportunities',
  'proposals',
  'clients',
  'projects',
  'communications',
  'library',
  'evaluations',
  'lessons',
  'hr',
  'experts',
  'timesheets',
  'leave',
  'strategy',
  'finance',
  'procurement',
  'knowledge',
] as const

export const createKnowledgeSchema = z.object({
  kind: z.enum(KNOWLEDGE_KINDS).default('article'),
  title: z.string().trim().min(1).max(240),
})

export const updateKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  excerpt: z.string().trim().max(500).nullish(),
  body: z.string().max(200000).nullish(),
  category: z.string().trim().max(120).nullish(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  contextKeys: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  allowedRoleIds: z.array(z.string().uuid()).max(50).optional(),
  status: z.enum(KNOWLEDGE_STATUSES).optional(),
})

export const knowledgeFeedbackSchema = z.object({
  helpful: z.boolean(),
  comment: z.string().trim().max(500).nullish(),
})
