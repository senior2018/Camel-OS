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

### S4–S6 — CRM (Clients, Prospects, Donors, Partners)
- **Account types**: client / prospect / donor / partner — one table, type-specific extras in a JSONB `metadata` column
- **Contacts**: many per client, with a primary-contact flag
- **Interactions timeline**: meetings, calls, emails, notes — plus donor-only **donor reporting** and **grant negotiation**, and partner-only **partnership meeting** categories
- **Opportunity links**: primary client shown on each opportunity card; many-to-many with secondary clients
- **Follow-up reminders**: per-assignee, time-of-day precision, dispatched every 5 minutes, with an admin **Run now** trigger
- **Relationship health score**: green/yellow/red dot per account based on recency of interaction; "At risk" once 60+ days idle
- **CSV import**: bulk-load contacts onto a client from a CSV template, with skip / overwrite duplicate handling and row-level error reporting
- **Donor grants**: funding cycles with start/end, total value, currency, tranches, reporting schedule, status; daily cron emails account owners 30 days before each deadline
- **Donor-funded projects (S6)**: link a donor to many projects with per-link funding amount + currency. Project records are a forward-compatible stub until the full Project Management module ships.
- **Partnership agreements (S6)**: per-partner agreements with start/end, value, status, document URL; daily cron emails the partner-account owner 90 and 30 days before each `endDate` (idempotency stamps per window)
- **Donor & partner dashboard (S6)**: totals, active grants + funding totals, active agreement totals, upcoming grant deadlines (60 days) and renewal radar (90 days), communication mix per type, recent communications, at-risk relationships (60+ days silent)
- **CRM activity report**: contacts reached, meetings held, pipeline value by period and staff member; CSV export + browser print

### S2–S3 — Opportunity Management
- **Views**: Stages (default), List, Manager Dashboard, Kanban (with drag-and-drop)
- **Stages**: Discovery → Qualifying → Proposal → Submitted → Won / Lost
- **Filters**: title search, multi-select stage / source / type, deadline range, value range
- **Per-opportunity**: owner assignment (emails the new owner), tags-free metadata, currency-aware estimated value, win probability, approve-to-pursue flag with audit
- **Attachments**: PDF / Word / Excel, 25 MB cap, Supabase Storage with signed URLs for download
- **Deadline reminders**: daily Nitro scheduled task (08:00 UTC), fires email at 14 / 7 / 2 days out
- **Audit**: every stage transition + approval + attachment event is hash-chained

### S11–S13 — Proposal Management + BD Tracking (MVP v0.1)

> **Scope note:** to reach a usable MVP sooner we **intentionally skipped S7–S10 (Communications)** and jumped from S6 straight to the Proposal Management block — **S11** (proposal foundation: teams, document upload, submission reference), **S12** (review gate, comments, dashboard, PDF export), **S13** (BD tracking: evaluation stages, win/loss report, contract→project). Communications is the next sprint.

A major pivot after the client demo: the opportunity becomes a lean **review pipeline**, and everything from drafting onward moves into a dedicated, configurable **Proposal** module — then hardened into a world-class workspace.

- **Opportunity = 3-status review pipeline**: **Pending → Accepted → Rejected**. Accept / Reject is **Manager-only** (`opportunity:approve`) — BD Officers create, Managers decide. Reviewer opinions + owner updates live in a per-opportunity comment thread (reason required on Reject). Tags + win probability re-introduced (`winProbabilitySource` column ready for AI later).
- **Auto-created proposals**: accepting an opportunity spawns a Proposal, with the opportunity creator set as **Lead** by default.
- **Three views, like opportunities**: **Board** (readable lanes, empty lanes drop away), **List** (filter to a single status), **Dashboard** (date-scoped win/loss analytics). Filter UX is basics-inline (search + status) with advanced filters behind an expand — no filter button.
- **Need-to-know visibility**: a user sees a proposal only if they're a member or its creator; oversight roles (`proposal:admin` / system admin) see all.
- **Proposal workspace**: tabbed (**Document / Team / Activity / Details**) with a persistent right rail (**Conversation** + **Documents**). Free-form **Tiptap** editor with debounced autosave and **document version history** (restore any snapshot).
- **Behaviors vs roles**: a fixed engine of behaviors (lead / writer / reviewer / approver / commenter / viewer) mapped to **configurable role labels** (Author, Technical / Finance / Compliance Reviewer, Final Approver, …).
- **Configurable workflow — system-wide *and* per-proposal**: role catalogue, review policy (minimum reviewers, all / N / %, require-final-approver), and evaluation outcome stages are all editable at `/admin/proposal-settings`, with per-proposal overrides. Nothing is hard-coded.
- **Manage Access**: the Lead assigns the team; **one role per person** enforces separation of duties (an editor cannot review their own work).
- **Review gate**: a single **Review** action → popup (Approve / Changes Required / Reject, reason required on reject) that posts the decision to the conversation; the configurable rule routes to final approval; **Final Approver** sign-off.
- **Conversation layer**: per-proposal chat + system events (created, status changes, review decisions) with a "reviewer decisions" filter — the need-to-know audit trail of the bid.
- **Outcomes**: Submitted → Won / Lost / Shortlisted / Clarification / Contract-signed; reason required on loss; **status override** (admin) to reverse a decision. Contract-signed spins up a stub Project (BD-04).
- **BD tracking**: win/loss report (`/reports/win-loss`, CSV + print), evaluation stages, weighted dashboard.
- **Scale guard**: list endpoints cap at 500 with a true total + a "showing most recent" notice, so a 1000-row pipeline never floods the browser.

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
| `clients:partnership-renewals` | `0 8 * * *` (08:00 UTC daily) | Emails partner account owners 90 + 30 days before each partnership agreement `endDate` |
| `clients:reminders` | `*/5 * * * *` (every 5 minutes) | Emails assignees when a client follow-up reminder is due |

Admins can manually trigger any task via `POST /api/admin/tasks/<task>`:
- `/api/admin/tasks/opportunity-reminders`
- `/api/admin/tasks/donor-grants`
- `/api/admin/tasks/partnership-renewals`
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

## How password-history reuse-prevention works

The password policy can require that a user's new password doesn't match any of their last N passwords. Common question: **how does this work when passwords are stored hashed?**

Plaintext passwords are **never** stored — anywhere, ever. What we store in `password_history` is each previous password's full hash (scrypt with a random per-password salt). On a password change:

1. The user submits a new plaintext password.
2. We pull the last N hashes from `password_history`.
3. For each historical hash, we run `verifyPassword(newPlaintext, oldHash)` — scrypt re-derives a hash from the new plaintext using the **salt embedded in the old hash**, then compares.
4. If any verification succeeds, the new password is a reuse and is rejected.
5. Otherwise, we hash the new password with a fresh salt, store it in `users`, and push the previous hash into `password_history`.

Salts are unique per password, so the same plaintext password used by two users produces different stored hashes — but we always verify against the matching salt, so the comparison is always meaningful. This is the standard pattern used by Auth0, AWS Cognito, and Microsoft Identity. No exotic tricks, no plaintext anywhere.

## Coding standards

See [CODING_STANDARDS.md](CODING_STANDARDS.md) (gitignored, local). Highlights:

- Every API write: `requirePermission(event, module, action)` + `logAuditEvent()`
- Every query scoped by `organizationId` (multi-tenant from day one)
- Zod-parse every request body — never `db.insert(...).values(req.body)`
- Design tokens only (`text-muted`, `bg-primary/10`) — never `text-gray-500`
- `<script setup lang="ts">` always; no Options API
- No manual component imports — Nuxt auto-imports

## Roadmap

Internal sprint detail lives in `PROGRESS.md` (gitignored). Major milestones:

- **MVP v0.1 — ✅ shipped** — Foundation → CRM (S1–S6) + Proposal Management & BD Tracking (S11–S13). **Communications (S7–S10) was intentionally deferred** to ship the MVP sooner.
- **Beta v0.5** — after S15 (Communications → Projects)
- **Beta v0.8** — after S23 (MEL → Procurement)
- **v1.0 GA** — after S30

### Next sprint — S7 Communications Officer

With the proposal pipeline MVP-complete, we circle back to the **deferred S7–S10 Communications block**, starting with the Communications Officer.

- **Proposal reference register** — link submitted proposals to the comms outputs and outreach they generate
- **Multi-recipient reminder dispatcher** — fan-out of proposal deadline/decision reminders to the captured recipient list (recipients are already stored; this lights up delivery)
- **Communications Officer / Lead workspace** — outreach log, templates, and channel tracking on top of the existing CRM interaction timeline

### Deferred — picked up in a later sprint

Conscious cuts from the proposal redesign, to be scheduled deliberately:

- **Real-time co-editing** — two writers editing live, with presence cursors (Yjs). Needs a persistent sync server; the production deploy is serverless (Vercel), so this pairs with a managed realtime provider or a standalone Node service.
- **Inline comments** — highlight a passage in the editor and thread a comment anchored to it (Google-Docs style).
- **Opportunity decision reversal** — reverse a Reject/Accept under an override permission, with guardrails against accidental flips.
- **AI assistance** — draft sections, summarise the conversation, suggest reviewers, and AI-driven win probability. The data model already carries `winProbabilitySource` so AI output slots in without a migration.

<!-- Vercel deploy trigger — bump a build number to force a redeploy -->
### For Vercel build
- build 1
- build 2
- build 3
- build 4
- build 5
- build 6
