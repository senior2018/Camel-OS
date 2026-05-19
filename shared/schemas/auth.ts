import { z } from 'zod'

/**
 * Accept-invitation request body. Re-validated on both sides because the password
 * never crosses the trust boundary unchecked.
 */
export const acceptInvitationSchema = z.object({
  token: z.string().min(8, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type AcceptInvitationPayload = z.output<typeof acceptInvitationSchema>

/**
 * Client-side schema for the accept-invite form; adds a confirmation field
 * (only enforced in the browser since the server only needs the password).
 */
export const acceptInvitationFormSchema = z
  .object({
    password: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type AcceptInvitationFormValues = z.output<typeof acceptInvitationFormSchema>
