import {
  type NewOrganization,
  type NewOrganizationMember,
  organizationMembers,
  organizations,
} from '../database/schema'
import { useDrizzle } from './drizzle'

export function generateOrgSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

export async function createDefaultOrganizationForUser(user: {
  id: string
  firstName: string
  lastName: string
}) {
  const db = useDrizzle()
  const orgName = `${user.firstName} ${user.lastName}'s Workspace`.trim()

  return db.transaction(async (tx) => {
    const [createdOrg] = await tx
      .insert(organizations)
      .values({
        id: crypto.randomUUID(),
        name: orgName,
        slug: generateOrgSlug(orgName),
        plan: 'free',
      } satisfies NewOrganization)
      .returning()

    if (!createdOrg) throw new Error('Failed to create default organization')

    const member: NewOrganizationMember = {
      organizationId: createdOrg.id,
      userId: user.id,
      role: 'owner',
    }

    await tx.insert(organizationMembers).values(member)

    return createdOrg
  })
}
