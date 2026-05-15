# Nuxt Starter Template

Starter template for new Nuxt projects with:

- Nuxt 4 + Nuxt UI
- ESLint + Prettier
- Supabase client setup
- Drizzle ORM wired for a Supabase Postgres database

## Setup

Install dependencies:

```bash
pnpm install
```

Copy the environment template:

```bash
cp .env.example .env
```

Fill in:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`

`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` come from the Supabase project connect dialog.

`DATABASE_URL` should point to your Supabase Postgres database. For Nuxt deployments on serverless platforms, prefer the Supabase connection pooler URL. If your pooler is using transaction mode, this starter disables prepared statements in the Drizzle `postgres` client to match Drizzle's Supabase guidance.

## Database

The starter includes:

- `drizzle.config.ts`
- `server/database/schema.ts`
- `server/utils/db.ts`
- `app/plugins/supabase.ts`

Available commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

The initial schema includes an `instruments` table so the starter matches Supabase's Nuxt quickstart example.

## Development

Run the app:

```bash
pnpm dev
```

Run checks:

```bash
pnpm lint
pnpm typecheck
```
