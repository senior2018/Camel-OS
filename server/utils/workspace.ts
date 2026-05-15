import {
  type NewWorkspace,
  type NewWorkspaceMember,
  workspaceMembers,
  workspaces
} from '../database/schema'
import { useDrizzle } from './drizzle'

export async function createDefaultWorkspaceForUser(user: {
  id: string
  firstName: string
  lastName: string
}) {
  const db = useDrizzle()
  const baseName = `${user.firstName} ${user.lastName}'s Workspace`.trim()
  const workspaceId = crypto.randomUUID()

  return db.transaction(async (tx) => {
    const [createdWorkspace] = await tx
      .insert(workspaces)
      .values({
        id: workspaceId,
        name: baseName
      } satisfies NewWorkspace)
      .returning()

    if (!createdWorkspace) {
      throw new Error('Failed to create default workspace')
    }

    const member: NewWorkspaceMember = {
      workspaceId: createdWorkspace.id,
      userId: user.id,
      role: 'admin',
      isOwner: true
    }

    await tx.insert(workspaceMembers).values(member)

    return createdWorkspace
  })
}
