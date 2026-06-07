import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import postgres from 'postgres'
import dotenv from 'dotenv'
import consola from 'consola'

import * as schema from '../server/database/schema'
import {
  authAccounts,
  opportunities,
  organizationMembers,
  organizations,
  roles,
  userRoles,
  users,
} from '../server/database/schema'

dotenv.config()

const ORG_SLUG = 'camel-os'
const PASSWORD = 'CamelOS@2025!'

// Demo cast. `roleName` is the RBAC account role (drives what they can see/do).
// The workflow role (Lead / Reviewer / Final Approver) is assigned per-proposal
// inside the app — see the demo guide.
const DEMO_USERS = [
  { email: 'david@camel-os.com', firstName: 'David', lastName: 'Director', roleName: 'Manager' },
  {
    email: 'doris@camel-os.com',
    firstName: 'Doris',
    lastName: 'Approver',
    roleName: 'Staff Member',
  },
  { email: 'rita@camel-os.com', firstName: 'Rita', lastName: 'Reviewer', roleName: 'Reviewer' },
  {
    email: 'linda@camel-os.com',
    firstName: 'Linda',
    lastName: 'Lead',
    roleName: 'Business Development Officer',
  },
  { email: 'sam@camel-os.com', firstName: 'Sam', lastName: 'Writer', roleName: 'Consultant' },
  { email: 'priya@camel-os.com', firstName: 'Priya', lastName: 'Writer', roleName: 'Consultant' },
] as const

async function run() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client, { schema })
  const hasher = new Hash(new Scrypt({}))

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, ORG_SLUG))
    .limit(1)
  if (!org) {
    consola.error(`Organization "${ORG_SLUG}" not found — run pnpm db:seed first.`)
    await client.end()
    process.exit(1)
  }

  // 1) Clear all opportunities. FK cascades remove proposals, comments,
  //    reviewers, assignments, activities, attachments, and opportunity_clients.
  const deleted = await db
    .delete(opportunities)
    .where(eq(opportunities.organizationId, org.id))
    .returning({ id: opportunities.id })
  consola.success(`Cleared ${deleted.length} opportunities (and all cascaded proposal data).`)

  // 2) Map role names → ids for this org.
  const orgRoles = await db.select().from(roles).where(eq(roles.organizationId, org.id))
  const roleId = (name: string) => orgRoles.find((r) => r.name === name)?.id

  const passwordHash = await hasher.make(PASSWORD)

  for (const u of DEMO_USERS) {
    const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1)
    if (existing) {
      consola.warn(`User ${u.email} already exists — skipping.`)
      continue
    }
    const rid = roleId(u.roleName)
    if (!rid) {
      consola.error(`Role "${u.roleName}" not found for ${u.email} — skipping.`)
      continue
    }

    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          organizationId: org.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          status: 'active',
          role: 'member',
          mfaRequired: false,
          emailVerifiedAt: new Date(),
        })
        .returning()
      if (!user) throw new Error(`Failed to create ${u.email}`)

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: user.id,
        role: 'member',
      })
      await tx.insert(authAccounts).values({
        userId: user.id,
        provider: 'local',
        passwordHash,
      })
      await tx.insert(userRoles).values({ userId: user.id, roleId: rid })
    })
    consola.success(`Created ${u.email}  (${u.roleName})`)
  }

  consola.box(
    [
      'Demo users ready — all log in with the same password:',
      `  Password: ${PASSWORD}`,
      '',
      ...DEMO_USERS.map((u) => `  ${u.email.padEnd(24)} ${u.roleName}`),
    ].join('\n')
  )

  await client.end()
  process.exit(0)
}

run().catch((err) => {
  consola.error(err)
  process.exit(1)
})
