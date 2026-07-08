# apps/web

Next.js app: UI, all API routes, auth, database, GitHub integration, and workflow orchestration for the agent's chat sessions.

## Authentication

Authentication uses [Better Auth](https://www.better-auth.com/) with Vercel OAuth (sign-in) and GitHub OAuth (repo access). Config lives in `lib/auth/config.ts`. Sessions are managed by better-auth's built-in session system — there is no manual JWE/encryption layer.

Key env vars: `BETTER_AUTH_SECRET` (session signing), `NEXT_PUBLIC_VERCEL_APP_CLIENT_ID` + `VERCEL_APP_CLIENT_SECRET` (Vercel OAuth), plus GitHub App credentials for repo access. See `.env.example` for the full list.

## Database & Migrations

Schema lives in `lib/db/schema.ts`. Migrations are managed by Drizzle Kit.

**After modifying `schema.ts`, always generate a migration:**

```bash
pnpm db:generate   # Creates a new .sql migration file (run from apps/web)
```

Commit the generated `.sql` file alongside the schema change. **Do not use `db:push`** except for local throwaway databases.

Migrations run automatically during `pnpm build` (via `lib/db/migrate.ts`), so every Vercel deploy — both preview and production — applies pending migrations to its own database.

### Environment isolation

Neon database branching is enabled in the Vercel project settings. Every preview deployment automatically gets its own isolated database branch forked from production. This means preview deployments never read or write production data. Production deployments use the main Neon database.

## Commands

Run these from `apps/web/`, or prefix with `pnpm --dir apps/web` from the repo root:

```bash
pnpm dev          # Next.js dev server
pnpm typecheck    # tsc --noEmit
pnpm db:check     # Verify migrations aren't out of sync with schema.ts
pnpm db:studio    # Drizzle Studio
```

## Key directories

- `app/` — routes and API handlers (App Router)
- `lib/auth/` — Better Auth config
- `lib/db/` — Drizzle schema, migrations, migration runner
- `lib/github/` — GitHub App integration (installation auth, PR content generation)
- `app/workflows/` — durable Workflow SDK runs that drive chat sessions and sandbox lifecycle

See the root [Architecture & Workspace Structure](../../docs/agents/architecture.md) doc and [Unified Agent Framework — Consolidation Plan](../../docs/agents/consolidation-plan.md) for how this app's agent runtime is being migrated onto eve.
