import { BrevoClient } from '@getbrevo/brevo'

let _client: BrevoClient | null = null

function getClient(): BrevoClient {
  if (_client) return _client
  const apiKey = useRuntimeConfig().brevoApiKey as string
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')
  _client = new BrevoClient({ apiKey })
  return _client
}

function getFromEmail(): string {
  return (useRuntimeConfig().brevoFromEmail as string) || 'noreply@camel-os.com'
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: 'Reset your Camel OS password',
      htmlContent: `
        <p>Hi,</p>
        <p>You requested a password reset for your Camel OS account.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
      `,
    })
  } catch (err) {
    // Strip provider-specific error shape so statusCode doesn't leak to the client
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
}
