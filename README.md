# Camel OS

Internal operating platform for Sahara Consult — a PSA (Professional Services Automation) + grant-program management system for management consulting firms.

> **Internal product.** No public landing page, no self-registration. Admins invite users.

## Tech stack

- **Frontend** — Nuxt 4, Nuxt UI v4, Tailwind v4
- **Backend** — Nitro server (TypeScript strict mode)
- **ORM** — Drizzle
- **Database** — PostgreSQL via Supabase (transaction pooler, port 6543)
- **Auth** — `nuxt-auth-utils` + scrypt password hashing
- **MFA** — TOTP via `otplib` + recovery codes; secrets AES-256-GCM encrypted at rest
- **Cache / rate limit** — ioredis token bucket (Upstash)
- **Email** — Brevo (`@getbrevo/brevo` v5)
- **Storage** — Supabase Storage (private bucket, signed URLs, service-role server-side only)
- **Validation** — Zod (shared schemas in `shared/schemas/` for client/server reuse)

## Modules delivered

### S1 — Foundation (Auth, RBAC, Audit)
- Admin invite flow (no self-registration), 7-day token expiry
- 12 default roles, per-module × per-action permissions in `shared/permissions.ts`
- TOTP MFA with role-based enforcement + recovery codes
- Password policy (length, character classes, expiry, history) + force-change
- 30-minute idle timeout
- Hash-chained audit log with viewer + CSV export

### S4–S5 — CRM (Clients, Prospects, Donors, Partners)
- **Account types**: client / prospect / donor / partner — one table, type-specific extras in a JSONB `metadata` column
- **Contacts**: many per client, with a primary-contact flag
- **Interactions timeline**: meetings, calls, emails, notes, with optional follow-up date + action
- **Opportunity links**: primary client shown on each opportunity card; many-to-many with secondary clients
- **Follow-up reminders**: per-assignee, time-of-day precision, dispatched every 5 minutes, with an admin **Run now** trigger
- **Relationship health score**: green/yellow/red dot per account based on recency of interaction; "At risk" once 60+ days idle
- **CSV import**: bulk-load contacts onto a client from a CSV template, with skip / overwrite duplicate handling and row-level error reporting
- **Donor grants**: funding cycles with start/end, total value, currency, tranches, reporting schedule, status; daily cron emails account owners 30 days before each deadline
- **CRM activity report**: contacts reached, meetings held, pipeline value by period and staff member; CSV export + browser print

### S2–S3 — Opportunity Management
- **Views**: Stages (default), List, Manager Dashboard, Kanban (with drag-and-drop)
- **Stages**: Discovery → Qualifying → Proposal → Submitted → Won / Lost
- **Filters**: title search, multi-select stage / source / type, deadline range, value range
- **Per-opportunity**: owner assignment (emails the new owner), tags-free metadata, currency-aware estimated value, win probability, approve-to-pursue flag with audit
- **Attachments**: PDF / Word / Excel, 25 MB cap, Supabase Storage with signed URLs for download
- **Deadline reminders**: daily Nitro scheduled task (08:00 UTC), fires email at 14 / 7 / 2 days out
- **Audit**: every stage transition + approval + attachment event is hash-chained

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Required vars:

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Base project URL (e.g. `https://xxxxx.supabase.co` — **no `/rest/v1/` suffix**) |
| `SUPABASE_PUBLISHABLE_KEY` | Anon key (browser-facing) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only, used for Storage admin ops) |
| `DATABASE_URL` | Supabase Postgres pooler URL, port 6543 |
| `NUXT_AUTH_ENCRYPTION_KEY` | Session secret — generate with `openssl rand -hex 32` |
| `REDIS_URL` | Upstash or any ioredis-compatible connection string |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `..._SECRET` | Google OAuth credentials |
| `BREVO_API_KEY` | Transactional email |
| `BREVO_FROM_EMAIL` | Verified sender on Brevo |
| `APP_URL` | Public app URL used in email links (no trailing slash) |

### 3. Create the Supabase Storage bucket

In the Supabase dashboard → **Storage → New bucket**:

- Name: `opportunity-attachments`
- Public: **off** (private — served via signed URLs)
- File size limit: 25 MB (optional, the server already enforces it)

### 4. Database

```bash
pnpm db:fresh      # reset + migrate + seed (one-shot, dev only)
pnpm db:generate   # generate migration from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:studio     # Drizzle Studio
```

After schema changes: `pnpm db:generate`, review the generated SQL in `server/database/migrations/`, then `pnpm db:migrate`.

### 5. Run

```bash
pnpm dev           # http://localhost:3000
pnpm lint          # ESLint
pnpm typecheck     # Nuxt typecheck (Vue + server)
pnpm build         # Production build
```

## Scheduled tasks

Configured via Nitro `scheduledTasks` in `nuxt.config.ts`:

| Task | Cron | Purpose |
|---|---|---|
| `opportunities:deadline-reminders` | `0 8 * * *` (08:00 UTC daily) | Emails opportunity owners 14 / 7 / 2 days before deadline |
| `clients:grants` | `0 8 * * *` (08:00 UTC daily) | Emails donor account owners 30 days before each grant end / next reporting deadline |
| `clients:reminders` | `*/5 * * * *` (every 5 minutes) | Emails assignees when a client follow-up reminder is due |

Admins can manually trigger any task via `POST /api/admin/tasks/<task>`:
- `/api/admin/tasks/opportunity-reminders`
- `/api/admin/tasks/donor-grants`
- `/api/admin/tasks/client-reminders` (also exposed as a **Run now** button on the client detail page)

Each task uses a `notified_at` (or `endDateNotifiedAt` / `nextReportingNotifiedAt`) stamp on its target rows so it never re-sends the same email.

### How client follow-up reminders work (CR-05)

When a staff member creates a reminder on a client, they pick a **due date + time** and an **assignee** (the person who should be reminded). The reminder lives in one of three states:

| State | Meaning | UI |
|---|---|---|
| **Pending** | Not yet emailed and not marked done | Yellow / red badge (red once overdue) |
| **Notified** | Email has been sent; user still needs to act on it | Still in the Pending list, no badge change |
| **Completed** | User checked it off | Moved to the Completed section, struck through |

The dispatcher runs **every 5 minutes**. On each tick it:

1. Looks for reminders where `due_at` ≤ now, **and** `notified_at` is empty, **and** `completed_at` is empty.
2. Emails the assignee for each match.
3. Stamps `notified_at` so the same reminder is never emailed twice.

**Maximum email delay** is 5 minutes after the due time. The interval is a deliberate trade-off between accuracy and infrastructure cost — second-accurate delivery would require a per-reminder job queue (BullMQ, Cloudflare Queues, etc.), which is overkill for follow-up reminders that aren't time-critical.

**Why "Run now" doesn't re-send a reminder that already fired**: once `notified_at` is stamped, every future run (manual or automatic) skips that reminder. To get a fresh email for the same client, create a new reminder. This prevents the cron from emailing the same reminder every 5 minutes forever once it's overdue.

**Completing vs. notifying**: marking a reminder done (the checkbox in the UI) is a separate user action from receiving the email. A reminder that's been emailed but not yet checked off stays in the Pending list — the email is just a nudge, not a status change. Admins can still see un-actioned items via the Pending list on the client page.

## Project layout

```
app/                   # Frontend (Nuxt srcDir)
  components/          # Vue components, auto-imported
  pages/               # Routes
  composables/         # use* hooks
  layouts/             # dashboard.vue, default.vue
server/
  api/                 # Nitro routes — [resource].<method>.ts
  database/
    schema.ts          # Drizzle table definitions (single source of truth)
    migrations/        # Generated by drizzle-kit — never hand-edit
  tasks/               # Nitro scheduled tasks
  utils/               # Server-only helpers
shared/
  schemas/             # Zod schemas reused on both client and server
  permissions.ts       # RBAC module + action catalog
```

## Coding standards

See [CODING_STANDARDS.md](CODING_STANDARDS.md) (gitignored, local). Highlights:

- Every API write: `requirePermission(event, module, action)` + `logAuditEvent()`
- Every query scoped by `organizationId` (multi-tenant from day one)
- Zod-parse every request body — never `db.insert(...).values(req.body)`
- Design tokens only (`text-muted`, `bg-primary/10`) — never `text-gray-500`
- `<script setup lang="ts">` always; no Options API
- No manual component imports — Nuxt auto-imports

## Sprint plan

Internal roadmap lives in `PROGRESS.md` (gitignored). Major milestones:

- **MVP v0.1** after S6 (Foundation → CRM)
- **Beta v0.5** after S15 (Comms → Projects)
- **Beta v0.8** after S23 (MEL → Procurement)
- **v1.0 GA** after S30
