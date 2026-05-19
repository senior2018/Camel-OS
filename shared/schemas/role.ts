import { z } from 'zod'

import { ACTIONS } from '../permissions'

const permissionSchema = z.object({
  module: z.string().trim().min(1).max(60),
  action: z.enum(ACTIONS),
})

/**
 * Body for `POST /api/admin/roles` and `PATCH /api/admin/roles/:id`.
 * `permissions` is the full set of `{module, action}` tuples for this role —
 * we replace the row's permissions wholesale rather than diff-patching.
 */
export const upsertRoleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).optional().nullable(),
  mfaRequired: z.boolean().optional().default(false),
  permissions: z.array(permissionSchema).max(500),
})

export type UpsertRolePayload = z.output<typeof upsertRoleSchema>

/** Body for `PUT /api/admin/users/:id/roles` — replaces the user's role set. */
export const setUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).max(50),
})

export type SetUserRolesPayload = z.output<typeof setUserRolesSchema>
