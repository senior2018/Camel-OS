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

// ─── Opportunities (S2 — OM-02, OM-03, OM-09) ──────────────────────────────────

export const opportunities = pgTable(
  'opportunities',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text(),
    source: opportunitySourceEnum().notNull().default('other'),
    type: opportunityTypeEnum().notNull().default('consulting'),
    stage: opportunityStageEnum().notNull().default('discovery'),
    // ISO date — RFPs and grant calls usually quote a calendar deadline, not an instant.
    deadline: date('deadline'),
    // Monetary value in `currency`; numeric(14,2) gives room up to 999,999,999,999.99.
    estimatedValue: numeric('estimated_value', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    // 0-100 — used by the manager dashboard (OM-06) once it ships.
    winProbability: integer('win_probability'),
    // Free-form tags as a text[] array — keeps OM-05 simple without a join table.
    tags: text('tags').array(),
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
    index('opportunities_owner_user_id_idx').on(table.ownerUserId),
    index('opportunities_deadline_idx').on(table.deadline),
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
