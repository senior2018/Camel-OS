import { and, eq, ne } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import postgres from 'postgres'
import dotenv from 'dotenv'
import consola from 'consola'

import * as schema from '../server/database/schema'
import {
  authAccounts,
  organizationMembers,
  organizations,
  roles,
  userRoles,
  users,
} from '../server/database/schema'

dotenv.config()

const ORG_SLUG = 'camel-os'
const SUPER = {
  email: 'simon@saharaventures.com',
  firstName: 'Simon',
  lastName: 'Sahara',
  password: 'CamelOS@2025!',
} as const

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

  const [sysRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.organizationId, org.id), eq(roles.name, 'System Administrator')))
    .limit(1)

  const passwordHash = await hasher.make(SUPER.password)

  await db.transaction(async (tx) => {
    let [user] = await tx.select().from(users).where(eq(users.email, SUPER.email)).limit(1)

    if (user) {
      await tx
        .update(users)
        .set({ status: 'active', role: 'system_admin', isSuperAdmin: true, updatedAt: new Date() })
        .where(eq(users.id, user.id))
      consola.success(`Updated existing user ${SUPER.email} → super admin`)
    } else {
      ;[user] = await tx
        .insert(users)
        .values({
          organizationId: org.id,
          email: SUPER.email,
          firstName: SUPER.firstName,
          lastName: SUPER.lastName,
          status: 'active',
          role: 'system_admin',
          isSuperAdmin: true,
          mfaRequired: false,
          emailVerifiedAt: new Date(),
        })
        .returning()
      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: user!.id,
        role: 'owner',
      })
      await tx.insert(authAccounts).values({
        userId: user!.id,
        provider: 'local',
        passwordHash,
      })
      consola.success(`Created ${SUPER.email} as super admin`)
    }

    // Assign the System Administrator role (idempotent).
    if (sysRole) {
      const existingRole = await tx
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, user!.id), eq(userRoles.roleId, sysRole.id)))
        .limit(1)
      if (existingRole.length === 0) {
        await tx.insert(userRoles).values({ userId: user!.id, roleId: sysRole.id })
      }
    }

    // Enforce one super admin per org — demote anyone else still flagged.
    const demoted = await tx
      .update(users)
      .set({ isSuperAdmin: false, updatedAt: new Date() })
      .where(
        and(eq(users.organizationId, org.id), eq(users.isSuperAdmin, true), ne(users.id, user!.id))
      )
      .returning({ email: users.email })
    for (const d of demoted)
      consola.info(`Demoted previous super admin: ${d.email} (still a system admin)`)
  })

  consola.box(
    ['Super admin ready ✔', `  Email   : ${SUPER.email}`, `  Password: ${SUPER.password}`].join(
      '\n'
    )
  )

  await client.end()
  process.exit(0)
}

run().catch((err) => {
  consola.error(err)
  process.exit(1)
})
