import type { H3Event } from 'h3'

/**
 * Guards the public /api/cron/* endpoints that platform schedulers (Vercel Cron,
 * an external uptime cron, etc.) call to run our scheduled jobs on hosts that
 * have no always-on Nitro task runner.
 *
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on cron
 * invocations when the CRON_SECRET env var is set. We require it so the
 * endpoints can't be triggered by the public. If CRON_SECRET is unset we refuse
 * outright (fail closed) rather than run unauthenticated.
 */
export function assertCronAuth(event: H3Event): void {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'CRON_SECRET is not configured' })
  }
  const auth = getHeader(event, 'authorization')
  if (auth !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
