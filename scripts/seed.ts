import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { hash, Algorithm } from '@node-rs/argon2'
import postgres from 'postgres'
import dotenv from 'dotenv'
import consola from 'consola'

import * as schema from '../server/database/schema'
import { authAccounts, organizationMembers, organizations, users } from '../server/database/schema'

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

  const passwordHash = await hash(SEED_ADMIN.password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

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

    consola.success(`Organization : ${org.name} (${org.id})`)
    consola.success(`Admin user   : ${adminUser.email} (${adminUser.id})`)
    consola.box(`Login → email: ${SEED_ADMIN.email}  |  password: ${SEED_ADMIN.password}`)
  })

  await client.end()
  consola.success('Seed complete')
}

seed().catch((e) => {
  consola.error('Seed failed:', e)
  process.exit(1)
})
