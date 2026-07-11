import { sql } from 'drizzle-orm'
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'pending_verification'])
export const userRoleEnum = pgEnum('user_role', ['system_admin', 'org_admin', 'member'])
export const authProviderEnum = pgEnum('auth_provider', ['local', 'google', 'microsoft'])
export const organizationMemberRoleEnum = pgEnum('organization_member_role', [
  'owner',
  'admin',
  'member',
])

// S7 refactor — Client feedback split: opportunity is now a 3-status pipeline
// (Pending / Accepted / Rejected) and the writing/submitting/winning happens on
// a separate Proposal record. The old `opportunity_stage` enum stays in the
// schema so the legacy `stage` column and the existing stage-activity tables
// keep migrating cleanly, but no UI references it any more.
export const opportunityStatusEnum = pgEnum('opportunity_status', [
  'pending',
  'accepted',
  'rejected',
])

// Provenance of `opportunities.win_probability`. Manual today; when the AI
// scorer lands it writes the same `win_probability` field and flips this to
// 'ai' — so the forecast dashboard (which reads one field) needs no rework.
export const winProbabilitySourceEnum = pgEnum('win_probability_source', ['manual', 'ai'])

export const opportunityStageEnum = pgEnum('opportunity_stage', [
  'discovery',
  'qualifying',
  'proposal',
  'submitted',
  'won',
  'lost',
])

export const opportunitySourceEnum = pgEnum('opportunity_source', [
  'tender',
  'grant',
  'partnership',
  'referral',
  'inbound',
  'other',
])

export const opportunityTypeEnum = pgEnum('opportunity_type', [
  'consulting',
  'training',
  'research',
  'advisory',
  'other',
])

// CRM enums. S4 introduced client/prospect; S5 added donor/partner (CR-08).
// One table, four sub-types — matches Salesforce/HubSpot's "Account with type"
// pattern. Type-specific structured data lives in `donor_grants` and
// `partnership_agreements`; free-form per-type extras live in `clients.metadata`.
export const clientTypeEnum = pgEnum('client_type', ['client', 'prospect', 'donor', 'partner'])

export const clientInteractionTypeEnum = pgEnum('client_interaction_type', [
  'meeting',
  'call',
  'email',
  'note',
  'other',
  // CR-13 — donor/partner-specific communication types. UI shows these only on
  // donor or partner profiles; the engagement report counts them separately so
  // donor stewardship effort is visible.
  'donor_reporting',
  'grant_negotiation',
  'partnership_meeting',
])

// ─── Organizations ─────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  plan: text().notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Users ─────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text().notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  avatarUrl: text('avatar_url'),
  status: userStatusEnum().notNull().default('pending_verification'),
  role: userRoleEnum().notNull().default('member'),
  // Per-user coarse MFA flag — finer-grained enforcement lives on roles.mfa_required.
  mfaRequired: boolean('mfa_required').notNull().default(false),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  // Password policy fields (UM-07)
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  // Soft-deactivation flag (UM-01)
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  // S5b: exactly one user per org may have this flag. Normal admins cannot
  // delete, demote, or change the super admin's password. Transferable by the
  // current super admin via a password-confirmed flow.
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Organization Members ───────────────────────────────────────────────────────

export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: organizationMemberRoleEnum().notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index('organization_members_user_id_idx').on(table.userId),
  ]
)

// ─── Auth Accounts ─────────────────────────────────────────────────────────────

export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: authProviderEnum().notNull(),
    providerUserId: varchar('provider_user_id', { length: 255 }),
    passwordHash: text('password_hash'),
    mfaSecret: text('mfa_secret'),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    // S5b: which second factor the user picked during setup. Drives the
    // login challenge UX — TOTP shows the 6-digit input, email triggers a
    // code-via-Brevo flow. Recovery codes work for both.
    mfaMethod: text('mfa_method').notNull().default('totp'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.userId, table.provider),
    unique().on(table.provider, table.providerUserId),
  ]
)

// ─── User Sessions ─────────────────────────────────────────────────────────────

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('user_sessions_user_id_idx').on(table.userId)]
)

// ─── Email Verification Tokens ─────────────────────────────────────────────────

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('email_verification_tokens_user_id_idx').on(table.userId)]
)

// ─── Password Reset Tokens ─────────────────────────────────────────────────────

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('password_reset_tokens_user_id_idx').on(table.userId)]
)

// ─── MFA Email Codes (S5b — alternate second factor) ──────────────────────────
// Short-lived (5 min) 6-digit codes emailed during the MFA challenge when the
// user's `mfaMethod` is 'email'. Stored hashed to match the same hygiene as
// password reset / email verification tokens.

export const mfaEmailCodes = pgTable(
  'mfa_email_codes',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('mfa_email_codes_user_id_idx').on(table.userId)]
)

// ─── MFA Recovery Codes ────────────────────────────────────────────────────────

export const mfaRecoveryCodes = pgTable(
  'mfa_recovery_codes',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('mfa_recovery_codes_user_id_idx').on(table.userId)]
)

// ─── Roles (UM-02) ─────────────────────────────────────────────────────────────

export const roles = pgTable(
  'roles',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    // If true, any user holding this role must have MFA enabled to access the app (UM-06).
    mfaRequired: boolean('mfa_required').notNull().default(false),
    // System roles are seeded per org and cannot be deleted via the UI.
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.organizationId, table.name),
    index('roles_organization_id_idx').on(table.organizationId),
  ]
)

// ─── Role Permissions (UM-02) ──────────────────────────────────────────────────

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    // Module name, e.g. 'opportunity', 'crm', 'finance', 'admin'. Free-form so new
    // modules can be added without a schema migration.
    module: text().notNull(),
    // Action verb, e.g. 'read' | 'create' | 'update' | 'delete' | 'admin'.
    action: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.module, table.action] }),
    index('role_permissions_role_id_idx').on(table.roleId),
  ]
)

// ─── User-Role Assignments (UM-03) ─────────────────────────────────────────────

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    assignedByUserId: uuid('assigned_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index('user_roles_user_id_idx').on(table.userId),
    index('user_roles_role_id_idx').on(table.roleId),
  ]
)

// ─── User Invitations (UM-01) ──────────────────────────────────────────────────

export const userInvitations = pgTable(
  'user_invitations',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    // Role assigned at acceptance time (single role at invite; multi-role later in admin UI).
    roleId: uuid('role_id').references(() => roles.id, { onDelete: 'set null' }),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_invitations_organization_id_idx').on(table.organizationId),
    index('user_invitations_email_idx').on(table.email),
  ]
)

// ─── Password Policies (UM-07) ─────────────────────────────────────────────────

export const passwordPolicies = pgTable('password_policies', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  minLength: integer('min_length').notNull().default(8),
  requireUppercase: boolean('require_uppercase').notNull().default(false),
  requireLowercase: boolean('require_lowercase').notNull().default(false),
  requireNumber: boolean('require_number').notNull().default(false),
  requireSymbol: boolean('require_symbol').notNull().default(false),
  // Days before a password expires; null = never expires.
  expiryDays: integer('expiry_days'),
  // Number of previous passwords to remember (prevent reuse). 0 = no history check.
  historyCount: integer('history_count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Password History (UM-07: reuse prevention) ────────────────────────────────

export const passwordHistory = pgTable(
  'password_history',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('password_history_user_id_idx').on(table.userId)]
)

// ─── Audit Log ─────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    resource: text().notNull(),
    action: text().notNull(),
    resourceId: text('resource_id'),
    meta: jsonb(),
    prevHash: text('prev_hash'),
    rowHash: text('row_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_log_organization_id_idx').on(table.organizationId),
    index('audit_log_user_id_idx').on(table.userId),
    index('audit_log_created_at_idx').on(table.createdAt),
  ]
)

// ─── CRM lookup values (S5b — admin-editable enums) ───────────────────────────
// Generic per-org lookup table. Today it powers opportunity sources and types;
// the `kind` column lets future modules add new lookup categories without
// another migration. `key` is the stable machine identifier we still store on
// the parent record (e.g. `opportunities.source`); `label` is the human name
// admins can rename freely. `archived_at` removes a value from new pickers
// without orphaning historical references.

export const crmLookupValues = pgTable(
  'crm_lookup_values',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    key: text().notNull(),
    label: text().notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('crm_lookup_values_org_kind_key_uq').on(table.organizationId, table.kind, table.key),
    index('crm_lookup_values_org_kind_idx').on(table.organizationId, table.kind),
  ]
)

// ─── Opportunities (S2 — OM-02, OM-03, OM-09) ──────────────────────────────────

export const opportunities = pgTable(
  'opportunities',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    // Free-text description added by the requester. Surfaced as the "extra
    // details" textarea on the create form.
    description: text(),
    // S5b — formerly opportunitySourceEnum / opportunityTypeEnum. Now plain
    // text keys, validated against `crm_lookup_values` (kind='opportunity_source'
    // / kind='opportunity_type') so admins can add new options without a
    // migration. The original enum keys are preserved as the seeded defaults.
    source: text().notNull().default('other'),
    type: text().notNull().default('consulting'),
    // Legacy stage column (S2–S5b). Kept so old data + the stage-activity
    // tables still resolve; UI now uses `status` exclusively.
    stage: opportunityStageEnum().notNull().default('discovery'),
    // S7 — Pending / Accepted / Rejected is the real review-pipeline column.
    // Pending = found, awaiting decision. Accepted = green-lit, a proposal
    // record is auto-created and the work moves there. Rejected = will not
    // pursue; comments thread captures the why.
    status: opportunityStatusEnum().notNull().default('pending'),
    // Reviewer-estimated win likelihood (0–100). Manual today; the spec calls
    // for an AI-driven calculation off historical wins later.
    winProbability: integer('win_probability'),
    // OM-06 / AI-readiness — how `winProbability` was set. Defaults to 'manual';
    // the future AI scorer sets 'ai'. Lets the dashboard badge the source and
    // lets AI slot in without touching reads.
    winProbabilitySource: winProbabilitySourceEnum('win_probability_source')
      .notNull()
      .default('manual'),
    // Free-form categorisation chips — re-introduced after client feedback.
    // Stored as a text[] so admins can search/filter without a join table.
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // ISO date — RFPs and grant calls usually quote a calendar deadline, not an instant.
    deadline: date('deadline'),
    // Monetary value in `currency`; numeric(14,2) gives room up to 999,999,999,999.99.
    estimatedValue: numeric('estimated_value', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    // OM-08: "Approved to Pursue" stamp. Null until an approver flips it.
    approvedToPursueAt: timestamp('approved_to_pursue_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('opportunities_organization_id_idx').on(table.organizationId),
    index('opportunities_stage_idx').on(table.stage),
    index('opportunities_status_idx').on(table.status),
    index('opportunities_owner_user_id_idx').on(table.ownerUserId),
    index('opportunities_deadline_idx').on(table.deadline),
  ]
)

// ─── Opportunity Comments (S7) ─────────────────────────────────────────────────
// Every reviewer can post a comment on an opportunity — used to capture the
// rationale behind accept/reject decisions and ongoing owner updates. A single
// optional attachment URL keeps the model simple while still letting the owner
// drop a link to a relevant doc (bulk file uploads live in opportunity_attachments).

export const opportunityCommentTypeEnum = pgEnum('opportunity_comment_type', ['comment', 'update'])

export const opportunityComments = pgTable(
  'opportunity_comments',
  {
    id: uuid().defaultRandom().primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // 'comment' = reviewer opinion (often paired with a Reject decision).
    // 'update' = owner status note as the opp progresses.
    kind: opportunityCommentTypeEnum().notNull().default('comment'),
    body: text().notNull(),
    attachmentUrl: text('attachment_url'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('opportunity_comments_opportunity_id_idx').on(table.opportunityId),
    index('opportunity_comments_organization_id_idx').on(table.organizationId),
    index('opportunity_comments_created_at_idx').on(table.createdAt),
  ]
)

// ─── Proposals (S7) ────────────────────────────────────────────────────────────
// When an opportunity is Accepted, a Proposal record is auto-created in the
// 'writing' state. The proposal carries its own lifecycle (writing → submitted
// → won / lost), its own deadline, and its own reminder recipients. Won and
// Lost no longer live on the opportunity — they belong to the proposal.

export const proposalStatusEnum = pgEnum('proposal_status', [
  'assigned',
  'drafting',
  'awaiting_review',
  'revision_required',
  'rejected',
  'ready_for_final_approval',
  'awaiting_final_approval',
  'final_approved',
  'final_rejected',
  'submitted',
  'won',
  'lost',
  'shortlisted',
  // S13 — appended (keep order stable so migrations stay additive ADD VALUE).
  'under_evaluation', // BD-01 post-submission evaluation
  'clarification_requested', // BD-01
  'contract_signed', // BD-04 — triggers project creation
])

export const proposalReviewerStatusEnum = pgEnum('proposal_reviewer_status', [
  'pending',
  'approved',
  'changes_required',
  'rejected',
])

export const opportunityDecisionStatusEnum = pgEnum('opportunity_decision_status', [
  'pending',
  'approved',
  'rejected',
])

export const proposalAssignmentRoleEnum = pgEnum('proposal_assignment_role', [
  'lead',
  // S11 — generic writing-team co-author and generic review-team member. The
  // legacy technical/finance/compliance values stay for existing data, but the
  // model is now: Lead + contributors (writers), and a flexible reviewer list
  // (PM-05 requires ≥3 to submit).
  'contributor',
  'reviewer',
  'technical_reviewer',
  'finance_reviewer',
  'compliance_reviewer',
  'final_approver',
  // Redesign v2 (P3.4) — access-only members (Google-Docs style): can see the
  // proposal and join the conversation, but don't write or review.
  'commenter',
  'viewer',
])

// S11 — how a proposal is authored: structured in-system sections, uploaded
// documents, or both. Drives which panel the proposal detail page shows.
export const proposalWritingModeEnum = pgEnum('proposal_writing_mode', [
  'in_system',
  'upload',
  'both',
])

// S13 (BD-02) — kind of post-submission tracking note.
export const proposalBdNoteKindEnum = pgEnum('proposal_bd_note_kind', [
  'client_comm',
  'evaluator_feedback',
  'note',
])

// Redesign v2 (P3) — conversation message kind. `message` = a person's chat
// post; `system` = an auto-generated workflow event (review decision, status
// change, membership change) rendered as a subtle event line.
export const proposalMessageKindEnum = pgEnum('proposal_message_kind', ['message', 'system'])

// Redesign v2 (P3.3) — how reviewer approvals are tallied before a proposal can
// move to final approval. `all` = every required reviewer; `count` = at least N;
// `percent` = at least P% of reviewers.
export const proposalReviewRuleEnum = pgEnum('proposal_review_rule', ['all', 'count', 'percent'])

export const proposals = pgTable(
  'proposals',
  {
    id: uuid().defaultRandom().primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    status: proposalStatusEnum().notNull().default('assigned'),
    // P3.3 — configurable review policy (per proposal). `reviewMinReviewers` is
    // the floor required before sending for review (PM-05 default 3).
    // `reviewRule` + `reviewThreshold` decide how many approvals advance it to
    // final approval. `requireFinalApprover` toggles the final sign-off step.
    reviewMinReviewers: integer('review_min_reviewers').notNull().default(3),
    reviewRule: proposalReviewRuleEnum('review_rule').notNull().default('all'),
    reviewThreshold: integer('review_threshold'),
    requireFinalApprover: boolean('require_final_approver').notNull().default(true),
    // P3.4 — per-proposal overrides of the org settings (null = inherit org).
    // `rolesOverride`: ProposalRoleDef[]; `outcomeStagesOverride`: string[].
    rolesOverride: jsonb('roles_override'),
    outcomeStagesOverride: jsonb('outcome_stages_override'),
    // P3.3b — free-text evaluation-stage label while a bid is under evaluation
    // (e.g. "Shortlisted", "Interview", "BAFO"). Keeps post-submission tracking
    // dynamic without locking the status enum. Null unless in evaluation.
    evaluationStage: text('evaluation_stage'),
    // ISO date — usually the bid submission deadline, separate from the
    // opportunity's discovery-stage deadline so a proposal team can manage its
    // own runway.
    deadline: date('deadline'),
    // Free-form draft content while writing — a richer editor can replace this
    // textarea later without changing the schema. Retained for backward compat;
    // the structured `proposal_sections` table is the primary authoring surface.
    contentDraft: text('content_draft'),
    // S12 (PM-04) — free-text brainstorming board for the writing team.
    brainstorm: text('brainstorm'),
    // S11 (PM-03) — how this proposal is being written.
    writingMode: proposalWritingModeEnum('writing_mode').notNull().default('in_system'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    // S11 (PM-09) — submission reference (e.g. portal ref / tender no.) + the
    // channel it was submitted through (email, portal, physical).
    submissionReference: text('submission_reference'),
    submissionChannel: text('submission_channel'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    // Optional reason for Lost — captured in the same field for Won/decided
    // notes if the team wants to leave context.
    decisionNote: text('decision_note'),
    // Reminder fan-out list (S7). The opportunity's own deadline emails the
    // owner; the proposal's deadline emails this whole list. Identity of the
    // recipients is the team's call — empty array is fine.
    reminderRecipientUserIds: uuid('reminder_recipient_user_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('proposals_opportunity_id_idx').on(table.opportunityId),
    index('proposals_organization_id_idx').on(table.organizationId),
    index('proposals_status_idx').on(table.status),
    index('proposals_deadline_idx').on(table.deadline),
  ]
)

// ─── Phase 1: Proposal Review Workflow ──────────────────────────────────────
// S8 Phase 1: Go-No-Go decision gate + team assignment + reviewer alignment.
//
// proposal_reviewers — tracks individual reviewer decisions (must all align)
// opportunity_decisions — Go-No-Go approval before proposal creation
// proposal_assignments — team roles (lead, technical, finance, etc)
// opportunity_activities — audit trail of all opportunity/proposal actions

export const proposalReviewers = pgTable(
  'proposal_reviewers',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    reviewerUserId: uuid('reviewer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reviewerRole: proposalAssignmentRoleEnum().notNull(),
    isRequired: boolean().notNull().default(true),
    status: proposalReviewerStatusEnum().notNull().default('pending'),
    feedback: text(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('proposal_reviewers_proposal_id_idx').on(table.proposalId),
    index('proposal_reviewers_reviewer_user_id_idx').on(table.reviewerUserId),
    index('proposal_reviewers_status_idx').on(table.status),
  ]
)

export const proposalAssignments = pgTable(
  'proposal_assignments',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // `roleType` is the engine behaviour (lead/contributor/reviewer/…).
    roleType: proposalAssignmentRoleEnum().notNull(),
    // P3.4 — the configured role label this assignment was made under, e.g.
    // "Technical Reviewer". Null = a plain role matching the behaviour.
    roleLabel: text('role_label'),
    assignedUserId: uuid('assigned_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('proposal_assignments_proposal_id_idx').on(table.proposalId),
    index('proposal_assignments_assigned_user_id_idx').on(table.assignedUserId),
    index('proposal_assignments_role_type_idx').on(table.roleType),
  ]
)

// ─── Configurable proposal settings (redesign v2 — P3.4) ────────────────────
// One row per organization holding the *system-wide* defaults that every
// proposal inherits: the configurable role catalogue, evaluation-outcome
// stages, and the default review policy. Absent row ⇒ fall back to the shipped
// DEFAULT_* constants. Per-proposal overrides live on `proposals`.
export const organizationProposalSettings = pgTable('organization_proposal_settings', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  // ProposalRoleDef[] — see shared/schemas/proposal-settings.ts
  roles: jsonb('roles').notNull(),
  // string[] — evaluation-stage labels
  outcomeStages: jsonb('outcome_stages').notNull(),
  reviewMinReviewers: integer('review_min_reviewers').notNull().default(3),
  reviewRule: proposalReviewRuleEnum('review_rule').notNull().default('all'),
  reviewThreshold: integer('review_threshold'),
  requireFinalApprover: boolean('require_final_approver').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Proposal Sections (S11 — PM-02, PM-03) ──────────────────────────────────
// Structured, co-authored sections of a proposal (Executive Summary, Technical
// Approach, Budget, …). Each can be owned by a contributor (section
// responsibility). Ordered by sortOrder. The body is the section's content.
export const proposalSections = pgTable(
  'proposal_sections',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    body: text(),
    sortOrder: integer('sort_order').notNull().default(0),
    // Section responsibility — the contributor who owns this section (nullable).
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // PM-03 — who last saved this section (for the "last edited by" line).
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('proposal_sections_proposal_id_idx').on(table.proposalId),
    index('proposal_sections_assigned_to_user_id_idx').on(table.assignedToUserId),
  ]
)

// ─── Proposal Document Versions (PM-03, redesign editor) ────────────────────
// Periodic snapshots of the single rich-text document (`proposals.contentDraft`)
// so editors get a version history with author attribution and can roll back.
// Throttled on save (one snapshot per editing burst) — see index.patch.ts.
export const proposalDocumentVersions = pgTable(
  'proposal_document_versions',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    content: text('content'),
    savedByUserId: uuid('saved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('proposal_document_versions_proposal_id_idx').on(table.proposalId)]
)

// ─── Proposal Section Versions (PM-03) ───────────────────────────────────────
// Save-history snapshot taken on every section update, so writers can see who
// changed what and roll back. One row per save of a section's body/title.
export const proposalSectionVersions = pgTable(
  'proposal_section_versions',
  {
    id: uuid().defaultRandom().primaryKey(),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => proposalSections.id, { onDelete: 'cascade' }),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    body: text(),
    savedByUserId: uuid('saved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('proposal_section_versions_section_id_idx').on(table.sectionId)]
)

// ─── Proposal Brainstorm Notes (PM-04) ───────────────────────────────────────
// Multi-note brainstorming board for the writing team. Supersedes the single
// free-text `proposals.brainstorm` column (kept for backward compatibility).
export const proposalBrainstormNotes = pgTable(
  'proposal_brainstorm_notes',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('proposal_brainstorm_notes_proposal_id_idx').on(table.proposalId)]
)

// ─── Proposal Conversation (redesign v2 — P3) ───────────────────────────────
// One running discussion per proposal (WhatsApp-style). Members chat here, and
// workflow events (review decisions, status changes) auto-post as `system`
// messages. `eventType` tags system rows so the UI can filter (e.g. "reviewer
// decisions only").
export const proposalMessages = pgTable(
  'proposal_messages',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: proposalMessageKindEnum().notNull().default('message'),
    body: text().notNull(),
    // For system rows — e.g. 'review_decision', 'status_change'. Null for chat.
    eventType: text('event_type'),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('proposal_messages_proposal_id_idx').on(table.proposalId)]
)

// ─── Communications — Content Items (S7, CC-01..07) ──────────────────────────
// Rich-text content (insights, reports, articles) authored in-platform, taken
// through a named-reviewer approval workflow, then published to the staff library.
export const contentStatusEnum = pgEnum('content_status', [
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'published',
  'archived',
])
export const contentReviewDecisionEnum = pgEnum('content_review_decision', [
  'pending',
  'approved',
  'changes_requested',
  'rejected',
])

// ─── Configurable communications review policy (CC — mirrors proposals P3.3) ──
// One row per organization: how many reviewers a content item needs, how their
// approvals are tallied (all / at least N / a percentage), and whether a final
// approver (the Communications Lead) must sign off before publishing. Absent
// row ⇒ fall back to DEFAULT_CONTENT_REVIEW_POLICY. `review_rule` is plain text
// validated by the shared zod schema (values: all | count | percent).
export const organizationCommunicationsSettings = pgTable('organization_communications_settings', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  reviewMinReviewers: integer('review_min_reviewers').notNull().default(1),
  reviewRule: text('review_rule').notNull().default('all'),
  reviewThreshold: integer('review_threshold'),
  requireFinalApprover: boolean('require_final_approver').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    // Content type label (insight / report / article / news / blog). Plain text
    // so admins can extend the vocabulary later via lookup values.
    type: text().notNull().default('insight'),
    category: text(),
    excerpt: text(),
    body: text(), // rich-text HTML (CC-01)
    coverImageUrl: text('cover_image_url'),
    tags: jsonb().$type<string[]>().notNull().default([]),
    status: contentStatusEnum().notNull().default('draft'),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    // CC-04 — planned publish date for the content calendar.
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    // CC-10 — optional campaign this content contributes to.
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('content_items_org_idx').on(table.organizationId),
    index('content_items_status_idx').on(table.status),
    index('content_items_campaign_idx').on(table.campaignId),
  ]
)

// ─── Communications — Campaigns (S8, CC-09..13) ──────────────────────────────
export const campaignStatusEnum = pgEnum('campaign_status', ['planning', 'active', 'closed'])

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    objective: text(),
    audience: text(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    budgetPlanned: numeric('budget_planned', { precision: 14, scale: 2 }),
    currency: text().notNull().default('USD'),
    status: campaignStatusEnum().notNull().default('planning'),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    // CC-13 — final report captured on close.
    reportSummary: text('report_summary'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('campaigns_org_idx').on(table.organizationId)]
)

// CC-08 — per-content engagement metrics (one row per content per date).
export const contentMetrics = pgTable(
  'content_metrics',
  {
    id: uuid().defaultRandom().primaryKey(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    metricDate: date('metric_date').notNull(),
    impressions: integer().notNull().default(0),
    clicks: integer().notNull().default(0),
    shares: integer().notNull().default(0),
    likes: integer().notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('content_metrics_content_idx').on(table.contentItemId),
    unique('content_metrics_content_date_uniq').on(table.contentItemId, table.metricDate),
  ]
)

// ─── Communications — Stakeholders (S9, CC-14..17) ───────────────────────────
export const stakeholderLevelEnum = pgEnum('stakeholder_level', ['high', 'medium', 'low'])

export const stakeholders = pgTable(
  'stakeholders',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    type: text(),
    sector: text(),
    geography: text(),
    influence: stakeholderLevelEnum().notNull().default('medium'),
    interest: stakeholderLevelEnum().notNull().default('medium'),
    // CC-15 — deliberate engagement strategy + owner.
    engagementStrategy: text('engagement_strategy'),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('stakeholders_org_idx').on(table.organizationId)]
)

// CC-16 — logged engagement activities per stakeholder.
export const stakeholderActivities = pgTable(
  'stakeholder_activities',
  {
    id: uuid().defaultRandom().primaryKey(),
    stakeholderId: uuid('stakeholder_id')
      .notNull()
      .references(() => stakeholders.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    activityDate: date('activity_date').notNull(),
    type: text().notNull(),
    description: text(),
    outcome: text(),
    nextStep: text('next_step'),
    loggedByUserId: uuid('logged_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('stakeholder_activities_stakeholder_idx').on(table.stakeholderId)]
)

// ─── Communications — Media Monitoring (S10, CC-18/20/21) ────────────────────
export const mediaSentimentEnum = pgEnum('media_sentiment', ['positive', 'neutral', 'negative'])
export const mediaSourceTypeEnum = pgEnum('media_source_type', [
  'print',
  'online',
  'tv',
  'radio',
  'social',
])

export const mediaMentions = pgTable(
  'media_mentions',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    outlet: text(),
    sourceType: mediaSourceTypeEnum('source_type').notNull().default('online'),
    sentiment: mediaSentimentEnum().notNull().default('neutral'),
    url: text(),
    mentionDate: date('mention_date').notNull(),
    summary: text(),
    // CC-21 — escalation to management.
    flagged: boolean().notNull().default(false),
    escalationNote: text('escalation_note'),
    flaggedByUserId: uuid('flagged_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    flaggedAt: timestamp('flagged_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('media_mentions_org_idx').on(table.organizationId),
    index('media_mentions_date_idx').on(table.mentionDate),
  ]
)

// CC-12 — planned vs actual spend lines per campaign.
export const campaignBudgetLines = pgTable(
  'campaign_budget_lines',
  {
    id: uuid().defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    label: text().notNull(),
    plannedAmount: numeric('planned_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    actualAmount: numeric('actual_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('campaign_budget_lines_campaign_idx').on(table.campaignId)]
)

// Approval workflow — ordered, named reviewers per content item (CC-02 / CC-03).
export const contentReviews = pgTable(
  'content_reviews',
  {
    id: uuid().defaultRandom().primaryKey(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    reviewerUserId: uuid('reviewer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stepOrder: integer('step_order').notNull().default(1),
    decision: contentReviewDecisionEnum().notNull().default('pending'),
    comment: text(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('content_reviews_content_item_id_idx').on(table.contentItemId)]
)

// Discussion thread on a content item (comments support for CC-02 / CC-03).
export const contentComments = pgTable(
  'content_comments',
  {
    id: uuid().defaultRandom().primaryKey(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('content_comments_content_item_id_idx').on(table.contentItemId)]
)

// ─── In-app notifications (lightweight; full NT-01 centre lands in S26) ───────
// A per-user feed surfaced by the header bell. Used by the content approval
// workflow (review requests, decisions) and media escalations (CC-21).
export const notifications = pgTable(
  'notifications',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    title: text().notNull(),
    body: text(),
    linkUrl: text('link_url'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.readAt)]
)

// ─── Proposal Section Comments (S12 — PM-06) ─────────────────────────────────
// Reviewer feedback anchored to a specific section, with threaded replies via
// `parentCommentId`. `sectionId` null = a general proposal-level comment.
export const proposalSectionComments = pgTable(
  'proposal_section_comments',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => proposalSections.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    parentCommentId: uuid('parent_comment_id'),
    body: text().notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('proposal_section_comments_proposal_id_idx').on(table.proposalId),
    index('proposal_section_comments_section_id_idx').on(table.sectionId),
  ]
)

// ─── Proposal BD Tracking Notes (S13 — BD-02) ────────────────────────────────
// Post-submission log: client communications + evaluator feedback against a
// submitted proposal, timestamped.
export const proposalBdNotes = pgTable(
  'proposal_bd_notes',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: proposalBdNoteKindEnum().notNull().default('note'),
    body: text().notNull(),
    // BD-02 — optional single file attachment (e.g. an evaluator's scoresheet).
    // Stored in the proposal-attachments bucket under a `…/bd/` key prefix.
    attachmentStorageKey: text('attachment_storage_key'),
    attachmentFileName: text('attachment_file_name'),
    attachmentMimeType: text('attachment_mime_type'),
    attachmentFileSize: integer('attachment_file_size'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('proposal_bd_notes_proposal_id_idx').on(table.proposalId)]
)

// ─── Proposal Attachments (S11 — PM-03 upload mode, PM-09) ───────────────────
// Uploaded proposal documents (Word/PDF/Excel) + a short brief. Mirrors the
// opportunity-attachments model; reuses the same Supabase Storage bucket with a
// `proposals/<id>/` key prefix.
export const proposalAttachments = pgTable(
  'proposal_attachments',
  {
    id: uuid().defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    storageKey: text('storage_key').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull(),
    brief: text(),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('proposal_attachments_proposal_id_idx').on(table.proposalId),
    index('proposal_attachments_organization_id_idx').on(table.organizationId),
  ]
)

export const opportunityDecisions = pgTable(
  'opportunity_decisions',
  {
    id: uuid().defaultRandom().primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    status: opportunityDecisionStatusEnum().notNull().default('pending'),
    decisionReason: text('decision_reason'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('opportunity_decisions_opportunity_id_idx').on(table.opportunityId),
    index('opportunity_decisions_status_idx').on(table.status),
  ]
)

export const opportunityActivities = pgTable(
  'opportunity_activities',
  {
    id: uuid().defaultRandom().primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    details: jsonb(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('opportunity_activities_opportunity_id_idx').on(table.opportunityId),
    index('opportunity_activities_created_at_idx').on(table.createdAt),
  ]
)

// ─── Opportunity Stage Activities + Transitions (S5b — workflow engine) ──────
// CR feedback from the client: "every stage has activities that should be done
// before moving to the next stage". This pair of tables turns drag-and-drop
// into a real workflow:
//
//   - `opportunity_stage_activities` — the per-stage checklist. Seeded for the
//     opp's current stage on entry so every teammate opens the modal and sees
//     the same to-do list. Users tick items off as they're done; custom items
//     can be added.
//
//   - `opportunity_stage_transitions` — every stage move captures the from →
//     to plus a comment. For 'lost', the comment is required (rejection
//     reason); for others it's optional context. The audit_log records who
//     moved what when; this table records why.

export const opportunityStageActivities = pgTable(
  'opportunity_stage_activities',
  {
    id: uuid().defaultRandom().primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stage: opportunityStageEnum().notNull(),
    label: text().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedByUserId: uuid('completed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('opportunity_stage_activities_opp_stage_idx').on(table.opportunityId, table.stage),
    index('opportunity_stage_activities_organization_id_idx').on(table.organizationId),
  ]
)

export const opportunityStageTransitions = pgTable(
  'opportunity_stage_transitions',
  {
    id: uuid().defaultRandom().primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fromStage: opportunityStageEnum('from_stage').notNull(),
    toStage: opportunityStageEnum('to_stage').notNull(),
    comment: text(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('opportunity_stage_transitions_opp_idx').on(table.opportunityId, table.createdAt),
    index('opportunity_stage_transitions_organization_id_idx').on(table.organizationId),
  ]
)

// ─── Opportunity Attachments (S3 — OM-10) ──────────────────────────────────────

export const opportunityAttachments = pgTable(
  'opportunity_attachments',
  {
    id: uuid().defaultRandom().primaryKey(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    // Object key inside the `opportunity-attachments` Supabase Storage bucket.
    // We never expose this directly — every download goes through a signed URL.
    storagePath: text('storage_path').notNull(),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('opportunity_attachments_opportunity_id_idx').on(table.opportunityId),
    index('opportunity_attachments_organization_id_idx').on(table.organizationId),
  ]
)

// ─── CRM — Clients (S4 — CR-01) ────────────────────────────────────────────────

export const clients = pgTable(
  'clients',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // `name` stays as the canonical display label and the primary duplicate-
    // detection key. Server-side it's auto-populated from firstName+lastName
    // or organization so the UI form never has to ask for it explicitly.
    name: text().notNull(),
    // S7 — split contact name + add organization. Donors and individual
    // partners often need a person's name; B2B clients have an organization.
    // All three are optional; at least one must be present at create time.
    firstName: text('first_name'),
    lastName: text('last_name'),
    organization: text(),
    type: clientTypeEnum().notNull().default('prospect'),
    // Industry / sector tag — free text since the firm covers many verticals.
    industry: text(),
    country: text(),
    website: text(),
    // Top-line phone on the account itself. Per-person numbers live on client_contacts.
    phone: text(),
    // Top-line email on the account — used for duplicate detection alongside primary contact email.
    email: text(),
    notes: text(),
    // Type-specific free-form fields (CR-08). Donor: focusAreas[], reportingLanguage,
    // fiscalYearStart. Partner: partnershipType, scope. Stored as JSONB so admins
    // can extend without a schema migration; structured data goes in dedicated tables.
    metadata: jsonb(),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    // Extra recipients for this client's automated reminders (donor grant
    // deadlines, partnership renewals). The owner is always notified; these are
    // additional people the team wants kept in the loop. Empty = owner only.
    reminderRecipientUserIds: uuid('reminder_recipient_user_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('clients_organization_id_idx').on(table.organizationId),
    index('clients_owner_user_id_idx').on(table.ownerUserId),
    index('clients_email_idx').on(table.email),
    index('clients_name_idx').on(table.name),
  ]
)

// ─── CRM — Client Contacts (S4 — CR-01, CR-02) ─────────────────────────────────

export const clientContacts = pgTable(
  'client_contacts',
  {
    id: uuid().defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    title: text(),
    email: text(),
    phone: text(),
    // Exactly one primary contact per client is conventional; enforced at app layer
    // rather than via a partial unique index to keep this portable.
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('client_contacts_client_id_idx').on(table.clientId),
    index('client_contacts_organization_id_idx').on(table.organizationId),
    index('client_contacts_email_idx').on(table.email),
  ]
)

// ─── CRM — Client Interactions (S4 — CR-02) ────────────────────────────────────

export const clientInteractions = pgTable(
  'client_interactions',
  {
    id: uuid().defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Nullable — an interaction may be against the account as a whole, not a person.
    contactId: uuid('contact_id').references(() => clientContacts.id, { onDelete: 'set null' }),
    type: clientInteractionTypeEnum().notNull().default('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    summary: text().notNull(),
    // CR-02 acceptance: "follow-up action recorded". When set, can pair with a reminder.
    followUpAt: date('follow_up_at'),
    followUpAction: text('follow_up_action'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('client_interactions_client_id_idx').on(table.clientId),
    index('client_interactions_organization_id_idx').on(table.organizationId),
    index('client_interactions_contact_id_idx').on(table.contactId),
    index('client_interactions_occurred_at_idx').on(table.occurredAt),
  ]
)

// ─── CRM — Opportunity ↔ Client link (S4 — CR-03) ──────────────────────────────
// Many-to-many pivot. `isPrimary` lets cards / lists show a single client without
// hiding the others; enforced at the app layer (one primary per opportunity).

export const opportunityClients = pgTable(
  'opportunity_clients',
  {
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.opportunityId, table.clientId] }),
    index('opportunity_clients_opportunity_id_idx').on(table.opportunityId),
    index('opportunity_clients_client_id_idx').on(table.clientId),
    index('opportunity_clients_organization_id_idx').on(table.organizationId),
  ]
)

// ─── CRM — Donor Grants (S5 — CR-09) ───────────────────────────────────────────
// Tracks a single funding cycle for a donor. Multiple grants per donor are
// allowed — each row carries its own start/end, value, currency, and reporting
// schedule. The dispatcher (server/utils/donor-grants.ts) emails the donor's
// owner 30 days before the next deadline; `endDateNotifiedAt` and
// `nextReportingNotifiedAt` are the idempotency stamps so each deadline only
// fires once.

export const donorGrantStatusEnum = pgEnum('donor_grant_status', [
  'pending',
  'active',
  'completed',
  'cancelled',
])

export const donorGrants = pgTable(
  'donor_grants',
  {
    id: uuid().defaultRandom().primaryKey(),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    totalValue: numeric('total_value', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    // Free-form description of the reporting cadence — e.g. "Quarterly, due 30
    // days after period end" — kept as text since the variety across donors is
    // huge. A `nextReportingDate` lets the cron alert without parsing the text.
    reportingSchedule: text('reporting_schedule'),
    nextReportingDate: date('next_reporting_date'),
    status: donorGrantStatusEnum().notNull().default('pending'),
    notes: text(),
    endDateNotifiedAt: timestamp('end_date_notified_at', { withTimezone: true }),
    nextReportingNotifiedAt: timestamp('next_reporting_notified_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('donor_grants_donor_id_idx').on(table.donorId),
    index('donor_grants_organization_id_idx').on(table.organizationId),
    index('donor_grants_end_date_idx').on(table.endDate),
    index('donor_grants_next_reporting_date_idx').on(table.nextReportingDate),
  ]
)

// ─── CRM — Client Reminders (S4 — CR-05) ───────────────────────────────────────
// Follow-up reminders surface to the assignee via daily email; in-app notification
// is wired when NT-01 lands in S26. Setting completedAt removes from the active list.

export const clientReminders = pgTable(
  'client_reminders',
  {
    id: uuid().defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => clientContacts.id, { onDelete: 'set null' }),
    // The user who owns this reminder — receives the email + sees it in their task list.
    assignedUserId: uuid('assigned_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Timestamptz (not date) so the user can capture a specific time for the
    // follow-up. The daily cron still ships at 08:00 UTC — the time is mostly
    // informational, but a future per-hour cron can use it for precision firing.
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    message: text().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // Idempotency stamp so the daily task doesn't email the same reminder twice.
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('client_reminders_client_id_idx').on(table.clientId),
    index('client_reminders_organization_id_idx').on(table.organizationId),
    index('client_reminders_assigned_user_id_idx').on(table.assignedUserId),
    index('client_reminders_due_at_idx').on(table.dueAt),
  ]
)

// ─── Projects (CR-10 stub — S13+ expands) ─────────────────────────────────────
// Minimal projects table introduced in S6 so we can link donors to the projects
// they fund. The real project-management module lands from S13; everything here
// is a forward-compatible subset (name, code, status window, budget) that the
// expanded module will read directly.

export const projectStatusEnum = pgEnum('project_status', [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
])

export const projects = pgTable(
  'projects',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    // Internal project code (optional) — many firms use a prefix like "TZ-2026-04".
    code: text(),
    description: text(),
    status: projectStatusEnum().notNull().default('planning'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    totalBudget: numeric('total_budget', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    // S14 (PJ-01) — delivery ownership + inherited context from the won proposal.
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    proposalId: uuid('proposal_id').references(() => proposals.id, { onDelete: 'set null' }),
    projectManagerUserId: uuid('project_manager_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    scope: text(),
    // PJ-05 — budget revision approval workflow. A revised budget must be
    // approved by a manager before it is considered the working baseline.
    // none = no pending revision; pending = awaiting sign-off; approved = signed.
    budgetRevisionStatus: text('budget_revision_status').notNull().default('none'),
    budgetRevisionNote: text('budget_revision_note'),
    // ME-06 — donor portal share token (null = disabled). Anyone with the link
    // sees the project's read-only results portal.
    portalToken: text('portal_token'),
    // PJ-11 — close + archive.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closeChecklist: jsonb('close_checklist').$type<Record<string, boolean>>(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('projects_organization_id_idx').on(table.organizationId),
    index('projects_status_idx').on(table.status),
  ]
)

// ─── Configurable project settings (S14/15 — mirrors proposal settings) ───────
// One row per organization holding the customizable vocabularies the module
// uses: report template sections, the close-out checklist, budget categories,
// and team roles — plus whether budget revisions need manager sign-off. Absent
// row ⇒ fall back to the shipped DEFAULT_PROJECT_SETTINGS. Editable by an admin
// or a project leader (project:admin), never hard-coded.
export const organizationProjectSettings = pgTable('organization_project_settings', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  reportSections: jsonb('report_sections').$type<string[]>().notNull(),
  closeChecklist: jsonb('close_checklist').$type<string[]>().notNull(),
  budgetCategories: jsonb('budget_categories').$type<string[]>().notNull(),
  teamRoles: jsonb('team_roles').$type<string[]>().notNull(),
  requireBudgetRevisionApproval: boolean('require_budget_revision_approval')
    .notNull()
    .default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Project Management (S14–S15, PJ-01..11) ─────────────────────────────────
export const projectMilestoneStatusEnum = pgEnum('project_milestone_status', [
  'not_started',
  'in_progress',
  'completed',
])
export const projectActivityStatusEnum = pgEnum('project_activity_status', [
  'todo',
  'in_progress',
  'blocked',
  'done',
])
export const projectReportStatusEnum = pgEnum('project_report_status', [
  'draft',
  'in_review',
  'approved',
])

// PJ-02 — project team with defined roles + allocation (for capacity warnings).
export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text().notNull().default('Team Member'),
    allocationPct: integer('allocation_pct').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_members_project_idx').on(table.projectId),
    unique('project_members_project_user_uniq').on(table.projectId, table.userId),
  ]
)

// PJ-03 — milestones with due dates + completion criteria (Gantt timeline).
export const projectMilestones = pgTable(
  'project_milestones',
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    dueDate: date('due_date'),
    completionCriteria: text('completion_criteria'),
    status: projectMilestoneStatusEnum().notNull().default('not_started'),
    orderIndex: integer('order_index').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('project_milestones_project_idx').on(table.projectId)]
)

// PJ-04 — granular activities under milestones, assigned, with dependencies.
export const projectActivities = pgTable(
  'project_activities',
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    milestoneId: uuid('milestone_id').references(() => projectMilestones.id, {
      onDelete: 'set null',
    }),
    name: text().notNull(),
    assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    plannedHours: numeric('planned_hours', { precision: 7, scale: 2 }),
    percentComplete: integer('percent_complete').notNull().default(0),
    status: projectActivityStatusEnum().notNull().default('todo'),
    dependsOnActivityId: uuid('depends_on_activity_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('project_activities_project_idx').on(table.projectId)]
)

// PJ-05 — budget by category + phase (original vs revised).
export const projectBudgetLines = pgTable(
  'project_budget_lines',
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    category: text().notNull(),
    phase: text(),
    originalAmount: numeric('original_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    revisedAmount: numeric('revised_amount', { precision: 14, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('project_budget_lines_project_idx').on(table.projectId)]
)

// PJ-07 — expenditure recorded against budget lines.
export const projectExpenses = pgTable(
  'project_expenses',
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    budgetLineId: uuid('budget_line_id').references(() => projectBudgetLines.id, {
      onDelete: 'set null',
    }),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    category: text(),
    expenseDate: date('expense_date').notNull(),
    description: text(),
    receiptUrl: text('receipt_url'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('project_expenses_project_idx').on(table.projectId)]
)

// PJ-08 — vendors / subcontractors.
export const projectVendors = pgTable(
  'project_vendors',
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    contractAmount: numeric('contract_amount', { precision: 14, scale: 2 }),
    currency: varchar({ length: 3 }).notNull().default('USD'),
    scope: text(),
    paymentSchedule: text('payment_schedule'),
    // PJ-08 — link the vendor's contract to a budget line category so its spend
    // rolls up under that budget line.
    budgetCategory: text('budget_category'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('project_vendors_project_idx').on(table.projectId)]
)

// PJ-09 — standardised project reports (template + draft/review/approved).
export const projectReports = pgTable(
  'project_reports',
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    content: text(),
    status: projectReportStatusEnum().notNull().default('draft'),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('project_reports_project_idx').on(table.projectId)]
)

// PJ-06 — lightweight timesheet entries (the full TS module, S18–S19, extends this).
export const timesheetStatusEnum = pgEnum('timesheet_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
])

export const timesheetEntries = pgTable(
  'timesheet_entries',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Nullable: internal (non-project) tasks carry a free-text taskLabel instead.
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id').references(() => projectActivities.id, {
      onDelete: 'set null',
    }),
    taskLabel: text('task_label'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entryDate: date('entry_date').notNull(),
    // Monday of entryDate's week — groups entries into a submittable timesheet.
    weekStartDate: date('week_start_date'),
    hours: numeric({ precision: 5, scale: 2 }).notNull(),
    note: text(),
    status: timesheetStatusEnum().notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('timesheet_entries_project_idx').on(table.projectId),
    index('timesheet_entries_user_week_idx').on(table.userId, table.weekStartDate),
  ]
)

// CR-10 — Donor ↔ project pivot. Funding amount is per-link (the same donor may
// contribute to many projects, the same project may have many donors). Currency
// follows the donor's preferred currency, not the project's, so each link carries
// its own.
export const donorProjects = pgTable(
  'donor_projects',
  {
    donorId: uuid('donor_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fundingAmount: numeric('funding_amount', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    notes: text(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.donorId, table.projectId] }),
    index('donor_projects_donor_id_idx').on(table.donorId),
    index('donor_projects_project_id_idx').on(table.projectId),
    index('donor_projects_organization_id_idx').on(table.organizationId),
  ]
)

// ─── Partnership agreements (CR-11) ────────────────────────────────────────────
// Tracks a single MOU / consortium / sub-grantee agreement with a partner. The
// renewal cron (server/utils/partnership-renewals.ts) emails the owner 90 days
// and again 30 days before `endDate`. Each window has its own idempotency stamp
// so each notification fires once.

export const partnershipAgreementStatusEnum = pgEnum('partnership_agreement_status', [
  'draft',
  'active',
  'expired',
  'terminated',
])

export const partnershipAgreements = pgTable(
  'partnership_agreements',
  {
    id: uuid().defaultRandom().primaryKey(),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    value: numeric('value', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    status: partnershipAgreementStatusEnum().notNull().default('draft'),
    documentUrl: text('document_url'),
    notes: text(),
    // Idempotency stamps — once a window fires, it stays fired until the
    // endDate changes (PATCH endpoint clears the stamp when endDate moves).
    renewalNotifiedAt90: timestamp('renewal_notified_at_90', { withTimezone: true }),
    renewalNotifiedAt30: timestamp('renewal_notified_at_30', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('partnership_agreements_partner_id_idx').on(table.partnerId),
    index('partnership_agreements_organization_id_idx').on(table.organizationId),
    index('partnership_agreements_end_date_idx').on(table.endDate),
    index('partnership_agreements_status_idx').on(table.status),
  ]
)

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type OrganizationMember = typeof organizationMembers.$inferSelect
export type NewOrganizationMember = typeof organizationMembers.$inferInsert

export type AuthAccount = typeof authAccounts.$inferSelect
export type NewAuthAccount = typeof authAccounts.$inferInsert

export type UserSession = typeof userSessions.$inferSelect
export type NewUserSession = typeof userSessions.$inferInsert

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert

export type MfaRecoveryCode = typeof mfaRecoveryCodes.$inferSelect
export type NewMfaRecoveryCode = typeof mfaRecoveryCodes.$inferInsert

export type MfaEmailCode = typeof mfaEmailCodes.$inferSelect
export type NewMfaEmailCode = typeof mfaEmailCodes.$inferInsert

export type CrmLookupValue = typeof crmLookupValues.$inferSelect
export type NewCrmLookupValue = typeof crmLookupValues.$inferInsert

export type OpportunityStageActivity = typeof opportunityStageActivities.$inferSelect
export type NewOpportunityStageActivity = typeof opportunityStageActivities.$inferInsert

export type OpportunityStageTransition = typeof opportunityStageTransitions.$inferSelect
export type NewOpportunityStageTransition = typeof opportunityStageTransitions.$inferInsert

export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert

export type RolePermission = typeof rolePermissions.$inferSelect
export type NewRolePermission = typeof rolePermissions.$inferInsert

export type UserRole = typeof userRoles.$inferSelect
export type NewUserRole = typeof userRoles.$inferInsert

export type UserInvitation = typeof userInvitations.$inferSelect
export type NewUserInvitation = typeof userInvitations.$inferInsert

export type PasswordPolicy = typeof passwordPolicies.$inferSelect
export type NewPasswordPolicy = typeof passwordPolicies.$inferInsert

export type PasswordHistory = typeof passwordHistory.$inferSelect
export type NewPasswordHistory = typeof passwordHistory.$inferInsert

export type AuditLog = typeof auditLog.$inferSelect
export type NewAuditLog = typeof auditLog.$inferInsert

export type Opportunity = typeof opportunities.$inferSelect
export type NewOpportunity = typeof opportunities.$inferInsert

export type OpportunityAttachment = typeof opportunityAttachments.$inferSelect
export type NewOpportunityAttachment = typeof opportunityAttachments.$inferInsert

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert

export type ClientContact = typeof clientContacts.$inferSelect
export type NewClientContact = typeof clientContacts.$inferInsert

export type ClientInteraction = typeof clientInteractions.$inferSelect
export type NewClientInteraction = typeof clientInteractions.$inferInsert

export type OpportunityClient = typeof opportunityClients.$inferSelect
export type NewOpportunityClient = typeof opportunityClients.$inferInsert

export type ClientReminder = typeof clientReminders.$inferSelect
export type NewClientReminder = typeof clientReminders.$inferInsert

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

export type ProjectMember = typeof projectMembers.$inferSelect
export type NewProjectMember = typeof projectMembers.$inferInsert
export type ProjectMilestone = typeof projectMilestones.$inferSelect
export type NewProjectMilestone = typeof projectMilestones.$inferInsert
export type ProjectActivity = typeof projectActivities.$inferSelect
export type NewProjectActivity = typeof projectActivities.$inferInsert
export type ProjectBudgetLine = typeof projectBudgetLines.$inferSelect
export type NewProjectBudgetLine = typeof projectBudgetLines.$inferInsert
export type ProjectExpense = typeof projectExpenses.$inferSelect
export type NewProjectExpense = typeof projectExpenses.$inferInsert
export type ProjectVendor = typeof projectVendors.$inferSelect
export type NewProjectVendor = typeof projectVendors.$inferInsert
export type ProjectReport = typeof projectReports.$inferSelect
export type NewProjectReport = typeof projectReports.$inferInsert
export type TimesheetEntry = typeof timesheetEntries.$inferSelect
export type NewTimesheetEntry = typeof timesheetEntries.$inferInsert

export type DonorProject = typeof donorProjects.$inferSelect
export type NewDonorProject = typeof donorProjects.$inferInsert

export type PartnershipAgreement = typeof partnershipAgreements.$inferSelect
export type NewPartnershipAgreement = typeof partnershipAgreements.$inferInsert

export type OpportunityComment = typeof opportunityComments.$inferSelect
export type NewOpportunityComment = typeof opportunityComments.$inferInsert

export type Proposal = typeof proposals.$inferSelect
export type NewProposal = typeof proposals.$inferInsert

export type ProposalReviewer = typeof proposalReviewers.$inferSelect
export type NewProposalReviewer = typeof proposalReviewers.$inferInsert

export type ProposalSection = typeof proposalSections.$inferSelect
export type NewProposalSection = typeof proposalSections.$inferInsert

export type ProposalSectionVersion = typeof proposalSectionVersions.$inferSelect
export type NewProposalSectionVersion = typeof proposalSectionVersions.$inferInsert

export type ProposalDocumentVersion = typeof proposalDocumentVersions.$inferSelect
export type NewProposalDocumentVersion = typeof proposalDocumentVersions.$inferInsert

export type ProposalBrainstormNote = typeof proposalBrainstormNotes.$inferSelect
export type NewProposalBrainstormNote = typeof proposalBrainstormNotes.$inferInsert

export type ProposalMessage = typeof proposalMessages.$inferSelect
export type NewProposalMessage = typeof proposalMessages.$inferInsert

export type OrganizationProposalSettings = typeof organizationProposalSettings.$inferSelect
export type NewOrganizationProposalSettings = typeof organizationProposalSettings.$inferInsert

export type ProposalSectionComment = typeof proposalSectionComments.$inferSelect
export type NewProposalSectionComment = typeof proposalSectionComments.$inferInsert

export type ProposalBdNote = typeof proposalBdNotes.$inferSelect
export type NewProposalBdNote = typeof proposalBdNotes.$inferInsert

export type ContentItem = typeof contentItems.$inferSelect
export type NewContentItem = typeof contentItems.$inferInsert

export type ContentReview = typeof contentReviews.$inferSelect
export type NewContentReview = typeof contentReviews.$inferInsert

export type ContentComment = typeof contentComments.$inferSelect
export type NewContentComment = typeof contentComments.$inferInsert

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert

export type CampaignBudgetLine = typeof campaignBudgetLines.$inferSelect
export type NewCampaignBudgetLine = typeof campaignBudgetLines.$inferInsert

export type ContentMetric = typeof contentMetrics.$inferSelect
export type NewContentMetric = typeof contentMetrics.$inferInsert

export type Stakeholder = typeof stakeholders.$inferSelect
export type NewStakeholder = typeof stakeholders.$inferInsert

export type StakeholderActivity = typeof stakeholderActivities.$inferSelect
export type NewStakeholderActivity = typeof stakeholderActivities.$inferInsert

export type MediaMention = typeof mediaMentions.$inferSelect
export type NewMediaMention = typeof mediaMentions.$inferInsert

export type ProposalAttachment = typeof proposalAttachments.$inferSelect
export type NewProposalAttachment = typeof proposalAttachments.$inferInsert

export type ProposalAssignment = typeof proposalAssignments.$inferSelect
export type NewProposalAssignment = typeof proposalAssignments.$inferInsert

export type OpportunityDecision = typeof opportunityDecisions.$inferSelect
export type NewOpportunityDecision = typeof opportunityDecisions.$inferInsert

export type OpportunityActivity = typeof opportunityActivities.$inferSelect
export type NewOpportunityActivity = typeof opportunityActivities.$inferInsert

export type DonorGrant = typeof donorGrants.$inferSelect
export type NewDonorGrant = typeof donorGrants.$inferInsert

// ─── Monitoring & Evaluation (S16, ME-01..06) ────────────────────────────────
export const melLevelEnum = pgEnum('mel_level', ['goal', 'outcome', 'output', 'indicator'])
export const melQuestionTypeEnum = pgEnum('mel_question_type', ['text', 'scale', 'multiple_choice'])
export const melEvaluationStatusEnum = pgEnum('mel_evaluation_status', ['draft', 'open', 'closed'])

// ME-01 — hierarchical results framework; leaf 'indicator' rows carry targets.
export const melIndicators = pgTable(
  'mel_indicators',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    level: melLevelEnum().notNull().default('indicator'),
    name: text().notNull(),
    baseline: numeric({ precision: 14, scale: 2 }),
    target: numeric({ precision: 14, scale: 2 }),
    unit: text(),
    frequency: text(),
    dataSource: text('data_source'),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('mel_indicators_project_idx').on(table.projectId)]
)

// ME-02 — periodic data entered against an indicator.
export const melDataPoints = pgTable(
  'mel_data_points',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    indicatorId: uuid('indicator_id')
      .notNull()
      .references(() => melIndicators.id, { onDelete: 'cascade' }),
    periodDate: date('period_date').notNull(),
    value: numeric({ precision: 14, scale: 2 }).notNull(),
    note: text(),
    evidenceUrl: text('evidence_url'),
    enteredByUserId: uuid('entered_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('mel_data_points_indicator_idx').on(table.indicatorId)]
)

// ME-04 — evaluation questionnaires distributed via a public link.
export const melEvaluations = pgTable(
  'mel_evaluations',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: text().notNull(),
    description: text(),
    status: melEvaluationStatusEnum().notNull().default('draft'),
    publicToken: text('public_token').unique(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('mel_evaluations_org_idx').on(table.organizationId)]
)

export const melQuestions = pgTable(
  'mel_questions',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    evaluationId: uuid('evaluation_id')
      .notNull()
      .references(() => melEvaluations.id, { onDelete: 'cascade' }),
    type: melQuestionTypeEnum().notNull().default('text'),
    prompt: text().notNull(),
    options: jsonb().$type<string[]>().notNull().default([]),
    orderIndex: integer('order_index').notNull().default(0),
    required: boolean().notNull().default(false),
  },
  (table) => [index('mel_questions_evaluation_idx').on(table.evaluationId)]
)

export const melResponses = pgTable(
  'mel_responses',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    evaluationId: uuid('evaluation_id')
      .notNull()
      .references(() => melEvaluations.id, { onDelete: 'cascade' }),
    respondentName: text('respondent_name'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('mel_responses_evaluation_idx').on(table.evaluationId)]
)

export const melAnswers = pgTable(
  'mel_answers',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    responseId: uuid('response_id')
      .notNull()
      .references(() => melResponses.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => melQuestions.id, { onDelete: 'cascade' }),
    value: text(),
  },
  (table) => [index('mel_answers_response_idx').on(table.responseId)]
)

// ME-05 — lessons learned, linked to a project, searchable by tag/sector.
export const melLessons = pgTable(
  'mel_lessons',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: text().notNull(),
    description: text(),
    sector: text(),
    tags: jsonb().$type<string[]>().notNull().default([]),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('mel_lessons_org_idx').on(table.organizationId)]
)

// ─── HR & Expert Database (S17–S19) ──────────────────────────────────────────

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time',
  'part_time',
  'contract',
  'consultant',
  'intern',
])
export const employeeStatusEnum = pgEnum('employee_status', [
  'active',
  'on_leave',
  'suspended',
  'terminated',
])
export const leaveTypeEnum = pgEnum('leave_type', [
  'annual',
  'sick',
  'unpaid',
  'maternity',
  'paternity',
  'compassionate',
  'study',
])
export const leaveStatusEnum = pgEnum('leave_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
])
export const expertAvailabilityEnum = pgEnum('expert_availability', [
  'available',
  'partially_available',
  'unavailable',
])

// HR-01 — one personnel file per employee.
export const employeeProfiles = pgTable(
  'employee_profiles',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    employeeNumber: text('employee_number'),
    jobTitle: text('job_title'),
    department: text(),
    employmentType: employmentTypeEnum('employment_type').notNull().default('full_time'),
    status: employeeStatusEnum().notNull().default('active'),
    managerUserId: uuid('manager_user_id').references(() => users.id, { onDelete: 'set null' }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    dateOfBirth: date('date_of_birth'),
    nationalId: text('national_id'),
    phone: text(),
    address: text(),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    // HR-03 — annual entitlement, in days; balance is this minus approved leave.
    annualLeaveEntitlement: numeric('annual_leave_entitlement', { precision: 5, scale: 1 })
      .notNull()
      .default('21'),
    baseSalary: numeric('base_salary', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('employee_profiles_user_unique').on(table.userId),
    index('employee_profiles_org_idx').on(table.organizationId),
  ]
)

// HR-03 / HR-04 — leave requests; the team calendar is derived from approved rows.
export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: leaveTypeEnum().notNull().default('annual'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    days: numeric('days', { precision: 5, scale: 1 }).notNull(),
    reason: text(),
    status: leaveStatusEnum().notNull().default('pending'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('leave_requests_org_idx').on(table.organizationId),
    index('leave_requests_user_idx').on(table.userId),
  ]
)

// HR-07 — certifications & training with expiry tracking.
export const certifications = pgTable(
  'certifications',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    issuer: text(),
    // 'certification' | 'training' — drives the badge/filter, not a hard enum
    // so orgs can add their own categories without a migration.
    kind: text().notNull().default('certification'),
    issuedDate: date('issued_date'),
    expiryDate: date('expiry_date'),
    credentialId: text('credential_id'),
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('certifications_org_idx').on(table.organizationId),
    index('certifications_user_idx').on(table.userId),
  ]
)

// EX-01 / EX-02 / EX-03 — expert profile (one per consultant) with virtual CV
// sections stored as JSONB and searchable skill/language/sector arrays.
export const expertProfiles = pgTable(
  'expert_profiles',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    headline: text(),
    summary: text(),
    yearsExperience: integer('years_experience'),
    dailyRate: numeric('daily_rate', { precision: 12, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    availability: expertAvailabilityEnum().notNull().default('available'),
    skills: jsonb().$type<string[]>().notNull().default([]),
    languages: jsonb().$type<{ language: string; proficiency: string }[]>().notNull().default([]),
    sectors: jsonb().$type<string[]>().notNull().default([]),
    countries: jsonb().$type<string[]>().notNull().default([]),
    // EX-02 — virtual CV sections.
    education: jsonb()
      .$type<{ institution: string; qualification: string; year?: string }[]>()
      .notNull()
      .default([]),
    experience: jsonb()
      .$type<
        {
          role: string
          organization: string
          startYear?: string
          endYear?: string
          description?: string
        }[]
      >()
      .notNull()
      .default([]),
    // EX-05 (S18) — assignment history, appended when assigned to a project.
    assignmentHistory: jsonb()
      .$type<
        {
          projectId?: string
          projectName: string
          role?: string
          startDate?: string
          endDate?: string
        }[]
      >()
      .notNull()
      .default([]),
    linkedinUrl: text('linkedin_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('expert_profiles_user_unique').on(table.userId),
    index('expert_profiles_org_idx').on(table.organizationId),
  ]
)

export type EmployeeProfile = typeof employeeProfiles.$inferSelect
export type NewEmployeeProfile = typeof employeeProfiles.$inferInsert
export type LeaveRequest = typeof leaveRequests.$inferSelect
export type NewLeaveRequest = typeof leaveRequests.$inferInsert
export type Certification = typeof certifications.$inferSelect
export type NewCertification = typeof certifications.$inferInsert
export type ExpertProfile = typeof expertProfiles.$inferSelect
export type NewExpertProfile = typeof expertProfiles.$inferInsert

// EX-06 — Personal Growth Plan (one per staff member, upserted).
export const growthPlans = pgTable(
  'growth_plans',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodLabel: text('period_label'),
    goals: jsonb()
      .$type<
        {
          area: string
          objective: string
          actions?: string
          targetDate?: string
          status: 'not_started' | 'in_progress' | 'achieved'
        }[]
      >()
      .notNull()
      .default([]),
    reviewNotes: text('review_notes'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('growth_plans_user_unique').on(table.userId),
    index('growth_plans_org_idx').on(table.organizationId),
  ]
)

export type GrowthPlan = typeof growthPlans.$inferSelect
export type NewGrowthPlan = typeof growthPlans.$inferInsert

// ─── Recruitment (HR-02) & Performance reviews (HR-05) — S19 ─────────────────

export const vacancyStatusEnum = pgEnum('vacancy_status', ['open', 'on_hold', 'closed', 'filled'])
export const applicantStageEnum = pgEnum('applicant_stage', [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
])
export const performanceReviewStatusEnum = pgEnum('performance_review_status', [
  'draft',
  'collecting',
  'completed',
])
export const feedbackRelationshipEnum = pgEnum('feedback_relationship', [
  'self',
  'manager',
  'peer',
  'report',
])

// HR-02 — job vacancy + its applicant pipeline.
export const jobVacancies = pgTable(
  'job_vacancies',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    department: text(),
    description: text(),
    employmentType: employmentTypeEnum('employment_type').notNull().default('full_time'),
    location: text(),
    openings: integer().notNull().default(1),
    status: vacancyStatusEnum().notNull().default('open'),
    closingDate: date('closing_date'),
    postedByUserId: uuid('posted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('job_vacancies_org_idx').on(table.organizationId)]
)

export const jobApplicants = pgTable(
  'job_applicants',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    vacancyId: uuid('vacancy_id')
      .notNull()
      .references(() => jobVacancies.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    email: text(),
    phone: text(),
    cvUrl: text('cv_url'),
    stage: applicantStageEnum().notNull().default('applied'),
    rating: integer(),
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('job_applicants_vacancy_idx').on(table.vacancyId)]
)

// HR-05 — a performance review for one subject, gathering 360° feedback.
export const performanceReviews = pgTable(
  'performance_reviews',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    subjectUserId: uuid('subject_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodLabel: text('period_label'),
    status: performanceReviewStatusEnum().notNull().default('draft'),
    overallRating: integer('overall_rating'),
    summary: text(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('performance_reviews_org_idx').on(table.organizationId)]
)

export const performanceFeedback = pgTable(
  'performance_feedback',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => performanceReviews.id, { onDelete: 'cascade' }),
    reviewerUserId: uuid('reviewer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    relationship: feedbackRelationshipEnum().notNull().default('peer'),
    rating: integer(),
    strengths: text(),
    improvements: text(),
    comments: text(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('performance_feedback_review_reviewer_unique').on(table.reviewId, table.reviewerUserId),
    index('performance_feedback_review_idx').on(table.reviewId),
  ]
)
