# Camel OS — Command Reference

All commands run with `pnpm <name>` from the project root.

> ⚠️ Every `db:*` command acts on whatever `DATABASE_URL` is set in `.env`.
> Confirm which database that points at before running destructive ones
> (`db:reset`, `db:fresh`, `db:demo-data`).

## Running the app

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server at http://localhost:3000 (hot-reload). Everyday command. |
| `pnpm build` | Compile a production build into `.output/`. Run before deploy / to catch build errors. |
| `pnpm preview` | Serve the production build locally to test it. |
| `pnpm postinstall` | Auto-runs after `pnpm install` (prepares Nuxt types). Not called manually. |

To stop a running dev server on port 3000:
```bash
lsof -ti:3000 | xargs kill        # add -9 if it won't stop
```

## Quality checks

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint over the codebase. Add `--fix` to auto-fix. |
| `pnpm typecheck` | TypeScript type checking. |

## Database (Drizzle ORM)

| Command | What it does |
|---|---|
| `pnpm db:generate` | Generate a migration SQL file from changes in `server/database/schema.ts`. |
| `pnpm db:migrate` | Apply pending migrations to the database. Creates/updates tables. |
| `pnpm db:push` | Push `schema.ts` directly to the DB (no migration file). Dev convenience only. |
| `pnpm db:studio` | Open Drizzle Studio — a browser GUI to view/edit rows. |
| `pnpm db:reset` | ⚠️ Drops all tables + enums (empties the database). Destructive. |
| `pnpm db:fresh` | Full rebuild: `db:reset` → `db:migrate` → `db:seed`. |

## Seeding

| Command | What it does |
|---|---|
| `pnpm db:seed` | Base seed: org + admin + 12 roles + lookup values. Required on a fresh DB. |
| `pnpm db:demo` | Creates the 6 core demo/workflow users. |
| `pnpm db:demo-data` | ⚠️ Wipes business data, then seeds the 50-each demo set (clients, opportunities, proposals, grants, agreements, roster users). Fake data. |
| `npx tsx ./scripts/seed-super-admin.ts` | Sets `simon@saharaventures.com` as the super admin (idempotent). |

## Common workflows

**Set up a brand-new database** (e.g. a new environment):
```bash
pnpm db:migrate     # build all tables from the migration baseline
pnpm db:seed        # org + admin login + roles + lookups
# pnpm db:demo-data # OPTIONAL: only if you want sample data
```

**Rebuild your local/dev database from scratch:**
```bash
pnpm db:fresh        # reset + migrate + base seed
pnpm db:demo-data    # optional sample data
```

**Before committing / deploying:**
```bash
pnpm lint && pnpm typecheck && pnpm build
```
