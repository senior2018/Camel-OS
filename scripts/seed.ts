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
  organizationMembers,
  organizations,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '../server/database/schema'
import { DEFAULT_ROLES, expandDefaultPermissions } from '../shared/permissions'

dotenv.config()

const SEED_ORG = {
  name: 'Camel OS',
  slug: 'camel-os',
  plan: 'enterprise',
} as const

const SEED_ADMIN = {
  email: 'admin@camel-os.com',
  firstName: 'System',
  lastName: 'Admin',
  // Change this after first login
  password: 'CamelOS@2025!',
} as const

async function seed() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client, { schema })

  consola.start('Seeding database...')

  const [existingOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, SEED_ORG.slug))
    .limit(1)

  if (existingOrg) {
    consola.warn(`Organization "${SEED_ORG.slug}" already exists — skipping seed`)
    await client.end()
    process.exit(0)
  }

  // Match the algorithm nuxt-auth-utils' `verifyPassword` uses (@adonisjs/hash → scrypt).
  // Hashing with anything else (e.g. argon2 directly) produces a format the verifier
  // cannot read, which is why earlier seed-then-login attempts silently failed.
  const hasher = new Hash(new Scrypt({}))
  const passwordHash = await hasher.make(SEED_ADMIN.password)

  await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values(SEED_ORG).returning()
    if (!org) throw new Error('Failed to create seed organization')

    const [adminUser] = await tx
      .insert(users)
      .values({
        organizationId: org.id,
        email: SEED_ADMIN.email,
        firstName: SEED_ADMIN.firstName,
        lastName: SEED_ADMIN.lastName,
        status: 'active',
        role: 'system_admin',
        emailVerifiedAt: new Date(),
      })
      .returning()

    if (!adminUser) throw new Error('Failed to create seed admin user')

    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      userId: adminUser.id,
      role: 'owner',
    })

    await tx.insert(authAccounts).values({
      userId: adminUser.id,
      provider: 'local',
      passwordHash,
    })

    // Seed default roles for the org and assign the System Administrator role to
    // the bootstrap admin so role-based permissions work from first login.
    for (const def of DEFAULT_ROLES) {
      const [createdRole] = await tx
        .insert(roles)
        .values({
          organizationId: org.id,
          name: def.name,
          description: def.description,
          mfaRequired: def.mfaRequired,
          isSystem: def.isSystem,
        })
        .returning({ id: roles.id, name: roles.name })

      if (!createdRole) throw new Error(`Failed to seed role: ${def.name}`)

      const permRows = expandDefaultPermissions(def).map((p) => ({
        roleId: createdRole.id,
        module: p.module,
        action: p.action,
      }))
      if (permRows.length > 0) {
        await tx.insert(rolePermissions).values(permRows)
      }

      if (createdRole.name === 'System Administrator') {
        await tx.insert(userRoles).values({
          userId: adminUser.id,
          roleId: createdRole.id,
        })
      }
    }

    consola.success(`Organization : ${org.name} (${org.id})`)
    consola.success(`Admin user   : ${adminUser.email} (${adminUser.id})`)
    consola.success(`Roles seeded : ${DEFAULT_ROLES.map((r) => r.name).join(', ')}`)
    consola.box(`Login → email: ${SEED_ADMIN.email}  |  password: ${SEED_ADMIN.password}`)
  })

  await client.end()
  consola.success('Seed complete')
}

seed().catch((e) => {
  consola.error('Seed failed:', e)
  process.exit(1)
})
