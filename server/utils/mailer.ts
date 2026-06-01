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

export async function sendEmailVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: 'Verify your Camel OS email',
      htmlContent: `
        <p>Hi,</p>
        <p>Thanks for signing up! Please verify your email address to activate your account.</p>
        <p><a href="${verifyUrl}">Click here to verify your email</a></p>
        <p>This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
      `,
    })
  } catch (err) {
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
}

export async function sendOpportunityDeadlineReminder(
  to: string,
  options: {
    recipientName: string
    title: string
    daysUntil: number
    deadline: string
    valueLabel: string | null
    url: string
  }
): Promise<void> {
  const when =
    options.daysUntil === 0
      ? 'today'
      : options.daysUntil === 1
        ? 'tomorrow'
        : `in ${options.daysUntil} days`

  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: `Reminder: "${options.title}" deadline ${when}`,
      htmlContent: `
        <p>Hi ${options.recipientName},</p>
        <p>This is a reminder that the deadline for <strong>${options.title}</strong> is ${when} (${options.deadline}).</p>
        ${options.valueLabel ? `<p>Estimated value: <strong>${options.valueLabel}</strong></p>` : ''}
        <p><a href="${options.url}">Open in Camel OS</a></p>
      `,
    })
  } catch (err) {
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
}

export async function sendOpportunityAssignmentEmail(
  to: string,
  options: {
    recipientName: string
    title: string
    assignerName: string
    deadline: string | null
    valueLabel: string | null
    url: string
  }
): Promise<void> {
  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: `You've been assigned to "${options.title}"`,
      htmlContent: `
        <p>Hi ${options.recipientName},</p>
        <p><strong>${options.assignerName}</strong> has assigned the opportunity <strong>${options.title}</strong> to you.</p>
        ${options.deadline ? `<p>Deadline: <strong>${options.deadline}</strong></p>` : ''}
        ${options.valueLabel ? `<p>Estimated value: <strong>${options.valueLabel}</strong></p>` : ''}
        <p><a href="${options.url}">Open in Camel OS</a></p>
      `,
    })
  } catch (err) {
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
}

export async function sendMfaEmailCode(
  to: string,
  options: { code: string; expiresInMinutes: number }
): Promise<void> {
  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: `Your Camel OS sign-in code: ${options.code}`,
      htmlContent: `
        <p>Your one-time sign-in code is:</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:600;font-family:monospace;">${options.code}</p>
        <p>This code expires in <strong>${options.expiresInMinutes} minutes</strong>. If you didn't try to sign in, ignore this email and consider rotating your password.</p>
      `,
    })
  } catch (err) {
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
}

export async function sendDonorGrantDeadlineEmail(
  to: string,
  options: {
    recipientName: string
    donorName: string
    grantTitle: string
    deadlineKind: string
    deadlineDate: string
    url: string
  }
): Promise<void> {
  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: `${options.deadlineKind} deadline approaching — ${options.donorName} / ${options.grantTitle}`,
      htmlContent: `
        <p>Hi ${options.recipientName},</p>
        <p><strong>${options.deadlineKind}</strong> deadline for grant <strong>${options.grantTitle}</strong> (donor: <strong>${options.donorName}</strong>) falls on <strong>${options.deadlineDate}</strong> — within the next 30 days.</p>
        <p><a href="${options.url}">Open in Camel OS</a></p>
      `,
    })
  } catch (err) {
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
}

export async function sendPartnershipRenewalEmail(
  to: string,
  options: {
    recipientName: string
    partnerName: string
    agreementTitle: string
    daysUntil: number
    endDate: string
    url: string
  }
): Promise<void> {
  const when = options.daysUntil <= 0 ? 'is now overdue' : `expires in ${options.daysUntil} days`
  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: `Partnership renewal — ${options.partnerName} / ${options.agreementTitle}`,
      htmlContent: `
        <p>Hi ${options.recipientName},</p>
        <p>The partnership agreement <strong>${options.agreementTitle}</strong> with <strong>${options.partnerName}</strong> ${when} (ends <strong>${options.endDate}</strong>). Now is a good time to start the renewal conversation.</p>
        <p><a href="${options.url}">Open in Camel OS</a></p>
      `,
    })
  } catch (err) {
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
}

export async function sendClientReminderEmail(
  to: string,
  options: {
    recipientName: string
    clientName: string
    message: string
    dueAt: string
    url: string
  }
): Promise<void> {
  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: `Follow-up reminder: ${options.clientName}`,
      htmlContent: `
        <p>Hi ${options.recipientName},</p>
        <p>You have a follow-up due for <strong>${options.clientName}</strong> on <strong>${options.dueAt}</strong>:</p>
        <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">${options.message}</blockquote>
        <p><a href="${options.url}">Open in Camel OS</a></p>
      `,
    })
  } catch (err) {
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
}

export async function sendInvitationEmail(
  to: string,
  options: {
    inviteeName: string
    inviterName: string
    organizationName: string
    acceptUrl: string
  }
): Promise<void> {
  try {
    await getClient().transactionalEmails.sendTransacEmail({
      sender: { name: 'Camel OS', email: getFromEmail() },
      to: [{ email: to }],
      subject: `You're invited to join ${options.organizationName} on Camel OS`,
      htmlContent: `
        <p>Hi ${options.inviteeName},</p>
        <p><strong>${options.inviterName}</strong> has invited you to join <strong>${options.organizationName}</strong> on Camel OS.</p>
        <p><a href="${options.acceptUrl}">Click here to accept your invitation and set your password</a></p>
        <p>This invitation expires in <strong>7 days</strong>. If you weren't expecting this, you can safely ignore this email.</p>
      `,
    })
  } catch (err) {
    throw new Error(`Failed to send email: ${(err as Error).message}`)
  }
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
