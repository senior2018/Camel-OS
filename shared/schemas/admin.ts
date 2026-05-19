import { z } from 'zod'

/**
 * Shape used to invite a new user into the workspace.
 * Used by `POST /api/admin/users/invite` and the admin invite modal.
 */
export const inviteUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(120),
  lastName: z.string().trim().min(1, 'Last name is required').max(120),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  roleId: z.string().uuid().optional(),
})

export type InviteUserPayload = z.output<typeof inviteUserSchema>
