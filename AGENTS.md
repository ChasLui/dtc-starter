# AGENTS.md

## Overview

Medusa DTC Starter — a bun workspace monorepo containing a Medusa backend (`@medusajs/medusa` latest, Node 20+) and an optional storefront (TanStack Start on Vite 8 + Rolldown).

**SQLite all-in-one.** The backend runs on a single SQLite file (`DATABASE_URL=sqlite://./medusa.sqlite`, created at `apps/backend/medusa.sqlite`) — no PostgreSQL, no Redis (Medusa 2.19 defaults to `event-bus-local` and `cache-inmemory`). This works because the root `package.json` `overrides` entry maps `@medusajs/deps` to the vendored fork at `vendor/@medusajs/deps`, whose `mikro-orm/postgresql` subpath re-exports `@mikro-orm/sqlite` (Medusa's whole DB layer resolves its driver through that subpath). `scripts/patch-sqlite.cjs` (the root `postinstall`) then rewrites the shipped Postgres-dialect migration files and knex/MikroORM glue in `node_modules` into SQLite equivalents. Never remove the `@medusajs/deps` override or the `postinstall` entry.

**Vite 8 (Rolldown) runs repo-wide.** The backend dev tooling + vitest, the storefront, and even Medusa's admin bundler all resolve `vite@8.x`: the root `package.json` `overrides` entry (`"vite": "^8.2.2"`) forces it, overriding `@medusajs/admin-bundler`'s own `^7.3.6` dep and `@medusajs/admin-vite-plugin`'s peer range (they work on 8 but have not declared it). Never remove that override.

## Directory Structure

```text
.
├── apps/
│   ├── backend/                  # Medusa application (@dtc/backend)
│   │   ├── medusa-config.ts      # Medusa config: DB URL, CORS, secrets, modules
│   │   ├── vitest.config.mts     # Vitest config (suites selected via TEST_TYPE)
│   │   ├── integration-tests/    # setup.js (Vitest setupFiles) and http/*.spec.ts suites
│   │   └── medusa.sqlite         # SQLite database file (gitignored, created by db:migrate)
│   │   └── src/
│   │       ├── admin/            # Admin dashboard extensions (widgets/, i18n/, routes)
│   │       ├── api/              # API routes: api/store/*, api/admin/* (file-based)
│   │       ├── jobs/             # Scheduled jobs
│   │       ├── links/            # Module links between modules
│   │       ├── migration-scripts/# Data migration scripts (e.g. initial-data-seed.ts)
│   │       ├── modules/          # Custom modules (service + models + migrations)
│   │       ├── subscribers/      # Event subscribers
│   │       └── workflows/        # Workflows and workflow steps
│   └── storefront/               # OPTIONAL storefront
├── .oxlintrc.json                # Root oxlint config: @medusajs/eslint-plugin via jsPlugins
├── .oxfmtrc.json                 # oxfmt config (semi: false, printWidth: 80)
├── vendor/@medusajs/deps/        # Vendored @medusajs/deps fork (mikro-orm/postgresql -> sqlite)
├── scripts/patch-sqlite.cjs      # Postinstall patch: translates Medusa to SQLite in node_modules
```

**`apps/storefront` is optional and may not exist.** It is skipped when the user chooses not to install it. Before running any storefront command, referencing storefront files, or assuming a full-stack change is possible, check that `apps/storefront/` exists. If it doesn't, the project is backend-only — do not scaffold it or suggest it was deleted by mistake.

Each app can have its own nested `AGENTS.md`; agents read the nearest one in the directory tree, so put app-specific context there rather than expanding this file.

## Package Manager

**The package manager is chosen at install time and is not fixed.** Detect it before running anything, in this order:

1. The `packageManager` field in the root `package.json` (e.g. `"bun@1.4.0"`) — authoritative when present.
2. The lockfile at the repo root: `bun.lock` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm.

```bash
node -p "require('./package.json').packageManager ?? 'unset'"
ls bun.lock pnpm-lock.yaml yarn.lock package-lock.json 2>/dev/null
```

Use that manager for every command and never introduce a second lockfile. Below, `<pm>` means the detected manager. The `<pm> run <script>` form works across npm, pnpm, yarn, and bun; for running a local binary use `<pm> exec <bin>` on npm/pnpm/yarn and `bunx <bin>` (or `bun run <bin>`) on bun. Workspace-filter flags differ per manager, so the per-app commands below `cd` into the app instead.

## Commands

Run from the repo root unless noted. There is no task runner: root scripts delegate to each app's own scripts via `bun run --cwd apps/<app> <script>`, and `dev`/`start` run both apps concurrently through `concurrently`. Commands against the storefront fail if `apps/storefront` is missing.

### Development

```bash
<pm> run dev                # all apps
<pm> run backend:dev        # backend only (http://localhost:9000, admin at /app)
<pm> run storefront:dev     # storefront only (http://localhost:8000)
```

### Build

```bash
<pm> run build              # all apps
<pm> run start              # build, then start both apps
```

### Lint

```bash
<pm> run lint                          # lint both apps (oxlint)
cd apps/backend && <pm> run lint       # oxlint — root .oxlintrc.json (loads @medusajs/eslint-plugin via jsPlugins)
cd apps/storefront && <pm> run lint    # oxlint — apps/storefront/.oxlintrc.json
```

### Format

```bash
<pm> run fmt                           # oxfmt — format the repo (skips *.md, *.yaml, bun.lock, src/routeTree.gen.ts)
<pm> run fmt:check                     # oxfmt --check — fail if anything is unformatted
```

### Test (backend only; the storefront has no test suite)

```bash
<pm> run test                                              # backend test suites (integration suites run against the sqlite file)
cd apps/backend && <pm> run test:unit                      # **/src/**/__tests__/**/*.unit.spec.ts
cd apps/backend && <pm> run test:integration:modules       # **/src/modules/*/__tests__/**
cd apps/backend && <pm> run test:integration:http          # **/integration-tests/http/*.spec.ts
```

Single test — pass a path/pattern through to Vitest, keeping `TEST_TYPE`:

```bash
cd apps/backend && <pm> run test:unit -- src/modules/foo/__tests__/service.unit.spec.ts
cd apps/backend && <pm> run test:unit -- -t "returns the cart"
```

### Database

```bash
cd apps/backend
<pm> exec medusa db:migrate --execute-all-links   # create the DB file, run migrations and sync link tables
<pm> exec medusa db:generate <module-name>        # generate migrations for a custom module
<pm> exec medusa user -e admin@test.com -p supersecret
<pm> run backend:seed                              # from root; runs src/migration-scripts/initial-data-seed.ts
```

SQLite notes:

- The database is a single file at `apps/backend/medusa.sqlite`, created on first
  connect by `db:migrate` (no `db:create` needed — the command is a no-op for
  sqlite URLs). `DATABASE_URL` in `apps/backend/.env` selects sqlite; copy
  `apps/backend/.env.template` to `.env` first.
- Always pass `--execute-all-links` to `db:migrate`: without it the link-table
  sync prompts interactively and is skipped in non-TTY shells, leaving the
  `*_sales_channel`-style link tables uncreated.
- Fresh installs need one env var so bun can build the `sqlite3` native binding
  (bun's ABI has no prebuilt; the Homebrew Python lacks distutils):

  ```bash
  npm_config_python=/usr/bin/python3 <pm> install
  ```

  The root `postinstall` then runs `scripts/patch-sqlite.cjs` automatically,
  which rewrites Medusa's Postgres-dialect code in `node_modules` into SQLite
  equivalents (migration SQL, knex client, advisory locks, sequential module
  boot, error mapping).

## Medusa Skills & MCP Server

These are optional but strongly recommended — they give documentation-backed answers instead of guesses about Medusa APIs. **Use them when available; if they are not, mention to the user that installing them meaningfully improves development on this project.**

**Agentic skills** ([docs](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/agentic-skills)) — if the `medusa-dev` skills are listed as available, load them *before* writing code, not after:

- `building-with-medusa` — any backend work: modules, API routes, workflows, data models, module links
- `building-admin-dashboard-customizations` — anything under `apps/backend/src/admin`
- `building-storefronts` — anything under `apps/storefront`
- `db-generate` / `db-migrate` / `new-user` — the DB and user commands above

If they are not installed, suggest:

```bash
/plugin marketplace add medusajs/medusa-agent-skills
/plugin install medusa-dev@medusa
```

**MCP server** ([docs](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/mcp-server)) — a `medusa` MCP server exposing the official docs. Prefer it over web search or memory for any Medusa API, config, or upgrade question. If it is not connected, suggest:

```bash
claude mcp add --transport http medusa https://docs.medusajs.com/mcp # or agent equivalent
```

## Code Style

- **The backend must satisfy `@medusajs/eslint-plugin`'s recommended rules**, enforced through `oxlint`: the root `.oxlintrc.json` loads the plugin via `jsPlugins` and enables its full rule set (workflows, API routes, modules, links, subscribers, jobs, admin). Those rules encode Medusa framework requirements — correct route/workflow/module shapes, not just cosmetics — so a lint failure usually means the code is actually wrong, not just badly formatted. Never disable a `@medusajs/*` rule to make lint pass; fix the code.
- Formatting is `oxfmt` (`.oxfmtrc.json`): no semicolons, double quotes, 2-space indent, printWidth 80. Run `<pm> run fmt` after editing; never reformat files oxfmt is configured to skip (`*.md`, `*.yaml`, `bun.lock`, `src/routeTree.gen.ts`).
- Files: kebab-case. Types/classes: PascalCase. Functions/variables: camelCase. DB columns: snake_case.
- No emojis in code, comments, or commit messages.

## Conventions

- **Backend routing is file-based.** A store endpoint is `src/api/store/<path>/route.ts` exporting `GET`/`POST`/etc. Don't add a router or register routes manually.
- **Business logic belongs in workflows**, not in route handlers. Routes resolve and run a workflow; workflows compose steps.
- Root `package.json` scripts delegate to app scripts with `bun run --cwd apps/<app> <script>`; to add a root task, wire the same script into each app that should run it.

## Common Mistakes

- Running storefront commands without checking that `apps/storefront/` exists.
- Assuming a package manager instead of detecting it, or running a command that creates a second lockfile.
- Installing a dependency at the root instead of inside the app that needs it (`cd apps/backend && <pm> add <pkg>`).
- Editing a custom module's model without running `<pm> exec medusa db:generate <module>` — the migration is missing and the change silently never applies.
- Writing raw SQL or importing DB clients directly in the backend instead of going through module services / workflows.
- Calling the Medusa API from the storefront without `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`; requests fail with a publishable-key error, not an obvious 401.
- Editing `vendor/@medusajs/deps` or `scripts/patch-sqlite.cjs` without re-running `bun install` / the patch script — the sqlite layer silently reverts to postgres.
- Silencing `@medusajs/*` oxlint rules instead of fixing the underlying pattern.
- Forgetting that backend `build`/`dev` run `medusa build --no-lint` / `medusa develop --no-lint`: Medusa's built-in ESLint step is disabled because linting moved to oxlint.

## Off-Limits

- `apps/backend/.medusa/`, `.next/`, `.output/`, `dist/`, `out/` — build output, excluded from the workspace and regenerated.
- The lockfile (`bun.lock`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json` — whichever this install produced) — never hand-edit or delete; change it only as a side effect of a package manager command.
- `.env` / `.env.local` — never commit, print, or copy secret values out of them. Edit `.env.template` instead when documenting a new variable.
- Existing migrations in `src/modules/*/migrations/` — add a new migration rather than rewriting one that may already have run.
- Don't run destructive DB commands (drops, `db:migrate --help`-style flags that reset state) against the user's database without explicit confirmation.
