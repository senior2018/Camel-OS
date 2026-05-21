import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'
import Papa from 'papaparse'
import { z } from 'zod'

import { clients, clientContacts } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * CR-07 — Bulk-import contacts onto a single client from a CSV upload.
 *
 * Wire format (multipart form):
 *   - `file`: the CSV — required, must include headers `first_name,last_name,title,email,phone`
 *   - `mode`: 'skip' (default) | 'overwrite' — what to do when an existing
 *     contact matches by email
 *
 * Response shape:
 *   { success: true, summary: { total, inserted, updated, skipped, errors: [{ row, message }] } }
 *
 * Validation runs per-row; the response includes every failed row with its
 * 1-based row number (header = row 0) so the UI can render a precise error
 * list — the spec calls this out explicitly.
 */
const HEADERS = ['first_name', 'last_name', 'title', 'email', 'phone'] as const

const rowSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  title: z
    .string()
    .trim()
    .max(150)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email')
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .max(50)
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB cap — contact CSVs are tiny.

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    if (!clientId) throw createError({ statusCode: 400, statusMessage: 'Client id is required' })

    const form = await readMultipartFormData(event)
    const filePart = form?.find((p) => p.name === 'file' && p.filename)
    const modePart = form?.find((p) => p.name === 'mode')
    const mode = modePart?.data?.toString() === 'overwrite' ? 'overwrite' : 'skip'

    if (!filePart || !filePart.data) {
      throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
    }
    if (filePart.data.length > MAX_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'File too large (2 MB max)' })
    }

    const text = filePart.data.toString('utf-8')
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    })

    if (parsed.errors.length) {
      throw createError({
        statusCode: 400,
        statusMessage: `CSV parse error: ${parsed.errors[0]?.message ?? 'invalid CSV'}`,
      })
    }

    const headers = parsed.meta.fields ?? []
    const missing = HEADERS.filter((h) => !headers.includes(h))
    if (missing.length === HEADERS.length) {
      throw createError({
        statusCode: 400,
        statusMessage: `CSV is missing all expected columns. Expected: ${HEADERS.join(', ')}`,
      })
    }

    const db = useDrizzle()

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)
    if (!client) throw createError({ statusCode: 404, statusMessage: 'Client not found' })

    // Validate every row up-front so a partial import doesn't surprise the user.
    interface ValidRow {
      rowNumber: number
      firstName: string
      lastName: string | null
      title: string | null
      email: string | null
      phone: string | null
    }
    const valid: ValidRow[] = []
    const errors: Array<{ row: number; message: string }> = []

    parsed.data.forEach((raw, idx) => {
      const rowNumber = idx + 2 // 1-based + header row
      const safe = rowSchema.safeParse(raw)
      if (!safe.success) {
        errors.push({ row: rowNumber, message: safe.error.issues[0]?.message ?? 'Invalid row' })
        return
      }
      valid.push({
        rowNumber,
        firstName: safe.data.first_name,
        lastName: safe.data.last_name ?? null,
        title: safe.data.title ?? null,
        email: safe.data.email ?? null,
        phone: safe.data.phone ?? null,
      })
    })

    // Identify duplicates (by email within this client only). Phone-based dup
    // detection causes too many false positives — same rationale as the
    // top-level client create endpoint.
    const emailsToCheck = valid.map((r) => r.email).filter((e): e is string => !!e)
    const existing = emailsToCheck.length
      ? await db
          .select({ id: clientContacts.id, email: clientContacts.email })
          .from(clientContacts)
          .where(
            and(eq(clientContacts.clientId, clientId), inArray(clientContacts.email, emailsToCheck))
          )
      : []
    const existingByEmail = new Map(existing.filter((r) => r.email).map((r) => [r.email!, r.id]))

    let inserted = 0
    let updated = 0
    let skipped = 0

    await db.transaction(async (tx) => {
      for (const r of valid) {
        const dupId = r.email ? existingByEmail.get(r.email) : undefined
        if (dupId) {
          if (mode === 'overwrite') {
            await tx
              .update(clientContacts)
              .set({
                firstName: r.firstName,
                lastName: r.lastName,
                title: r.title,
                phone: r.phone,
                updatedAt: new Date(),
              })
              .where(eq(clientContacts.id, dupId))
            updated++
          } else {
            skipped++
          }
          continue
        }
        await tx.insert(clientContacts).values({
          clientId,
          organizationId: ctx.organizationId,
          firstName: r.firstName,
          lastName: r.lastName,
          title: r.title,
          email: r.email,
          phone: r.phone,
          isPrimary: false,
        })
        inserted++
      }
    })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'contacts_imported',
      resourceId: clientId,
      meta: {
        total: valid.length + errors.length,
        inserted,
        updated,
        skipped,
        errors: errors.length,
        mode,
        fileName: filePart.filename,
      },
    })

    return {
      success: true,
      summary: {
        total: valid.length + errors.length,
        inserted,
        updated,
        skipped,
        errors,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error importing contacts', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
