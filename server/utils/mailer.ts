import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (_resend) return _resend
  const apiKey = useRuntimeConfig().resendApiKey as string
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  _resend = new Resend(apiKey)
  return _resend
}

function getFromEmail(): string {
  return (useRuntimeConfig().resendFromEmail as string) || 'Camel OS <noreply@camel-os.com>'
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await getResend().emails.send({
    from: getFromEmail(),
    to,
    subject: 'Reset your Camel OS password',
    html: `
      <p>Hi,</p>
      <p>You requested a password reset for your Camel OS account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
    `,
  })
}
