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
  'technical_reviewer',
  'finance_reviewer',
  'compliance_reviewer',
  'final_approver',
])

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
    // ISO date — usually the bid submission deadline, separate from the
    // opportunity's discovery-stage deadline so a proposal team can manage its
    // own runway.
    deadline: date('deadline'),
    // Free-form draft content while writing — a richer editor can replace this
    // textarea later without changing the schema.
    contentDraft: text('content_draft'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
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
    roleType: proposalAssignmentRoleEnum().notNull(),
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

export type ProposalAssignment = typeof proposalAssignments.$inferSelect
export type NewProposalAssignment = typeof proposalAssignments.$inferInsert

export type OpportunityDecision = typeof opportunityDecisions.$inferSelect
export type NewOpportunityDecision = typeof opportunityDecisions.$inferInsert

export type OpportunityActivity = typeof opportunityActivities.$inferSelect
export type NewOpportunityActivity = typeof opportunityActivities.$inferInsert

export type DonorGrant = typeof donorGrants.$inferSelect
export type NewDonorGrant = typeof donorGrants.$inferInsert
