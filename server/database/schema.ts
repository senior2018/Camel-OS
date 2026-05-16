import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
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
  mfaRequired: boolean('mfa_required').notNull().default(false),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
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

export type AuditLog = typeof auditLog.$inferSelect
export type NewAuditLog = typeof auditLog.$inferInsert
