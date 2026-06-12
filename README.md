# Bolao dos Facabundos 2026

Web app for a Brazilian World Cup 2026 bolao. Players create accounts, confirm
their email, submit locked score predictions, pick champion/runner-up/third
place, browse submitted predictions, and follow the leaderboard.

The app is local-first right now. Production deployment is planned for
`bolao.parmezani.com`, behind Caddy on the `parmavps` VPS, but
the repo can be developed and validated fully on a local machine.

## What Is Implemented

- Public homepage, schedule, rules, and submitted-predictions pages. Homepage
  cards render from database data and show empty states instead of sample rows.
- Signup/login/logout with local session cookies, Argon2id password hashes, and
  optional Resend-backed account confirmation email.
- Admin-generated, single-use password reset links for account recovery.
- Authenticated player dashboard and prediction forms in a logged-in sidebar.
- Player avatar upload from the dashboard, stored as a small validated image on
  the user record and shown beside names in ranking/prediction widgets.
- Group-stage predictions with confirmation and immutability.
- Knockout predictions that stay locked until Round-of-32 fixtures are real teams.
- Champion, runner-up, and third-place picks using the same deadline as group predictions.
- Scoring engine, placement bonuses, and leaderboard recomputation.
- Static tournament seed and worker sync based on public OpenFootball data.
- Admin area for health, matches, users, submissions, scoring, settings, audit,
  CSV exports, and a full predictions export.
- Production Dockerfile and Compose scaffold for later deployment handoff.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- Prisma
- PostgreSQL
- Vitest
- Docker Compose for local Postgres

## Requirements

- Node.js 22 or newer
- npm
- Docker with Compose plugin
- A local shell with access to this repository

Optional:

- Chromium or another browser for visual/browser smoke checks.

## Quick Start

From the repository root:

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Open:

```text
http://localhost:3000
```

The default `.env.example` creates a local admin during seed:

```text
email: admin@local.test
password: troque-esta-senha-local
```

Use a different password in your local `.env` if you are sharing the machine or
exposing the dev server.

## Environment Variables

Local development uses `.env`.

Required:

```env
DATABASE_URL="postgresql://bolao:bolao_dev_password@localhost:5432/bolao_copa_2026?schema=public"
```

Recommended for local admin seed:

```env
ADMIN_EMAIL="admin@local.test"
ADMIN_DISPLAY_NAME="Admin"
ADMIN_PASSWORD="troque-esta-senha-local"
```

Optional transactional email through Resend:

```env
APP_URL="http://localhost:3000"
EMAIL_FROM="Bolão dos Facabundos <noreply@example.com>"
RESEND_API_KEY=""
```

If `RESEND_API_KEY` or `EMAIL_FROM` is empty, email sends are skipped so local
development keeps working.

Production/prod-like Compose also expects:

```env
POSTGRES_DB=bolao_copa_2026
POSTGRES_USER=bolao
POSTGRES_PASSWORD=troque-esta-senha
AUTH_SECRET=troque-por-um-segredo-longo
APP_URL=https://bolao.parmezani.com
PRIMARY_DATA_PROVIDER=openfootball-static
WORKER_INTERVAL_SECONDS=300
```

Optional provider tokens are wired but not required for local work:

```env
SPORTMONKS_API_TOKEN=
FOOTBALL_DATA_API_TOKEN=
```

## Database Workflow

Start local Postgres:

```bash
docker compose up -d
```

Validate Prisma schema:

```bash
npm run prisma:validate
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Apply migrations in development:

```bash
npx prisma migrate dev
```

Check migration status:

```bash
npx prisma migrate status
```

Seed local data:

```bash
npm run prisma:seed
```

The seed imports teams, matches, standings placeholders, scoring defaults,
deadlines, placement bonuses, and the optional admin user.

## Data Source

Initial tournament data lives in:

```text
prisma/seed-data/openfootball-2026/
```

It is based on the public OpenFootball World Cup 2026 dataset. The local seed
imports 48 teams and 104 matches. Match times are stored in UTC and rendered in
`America/Sao_Paulo`.

The worker can re-sync the same static source. Live-score and standings provider
interfaces exist, but no paid provider is required for local development.

The app should not scrape FIFA pages. If a live provider is added later, prefer
official/public documented APIs first.

## App Routes

Public:

- `/`
- `/ranking`
- `/matches`
- `/rules`
- `/predictions` public viewer of active players and confirmed predictions
- `/login`
- `/signup`
- `/reset-password?token=...`

Authenticated:

- `/dashboard`
- `/api/me/avatar`
- `/predictions/group`
- `/predictions/knockout`
- `/predictions/winners`

Admin-only:

- `/admin`
- `/admin/matches`
- `/admin/users`
- `/admin/submissions`
- `/admin/scoring`
- `/admin/settings`
- `/admin/audit`

## Prediction Rules

Default deadlines are stored in app settings:

- group predictions: `2026-06-11 23:59 America/Sao_Paulo`
- knockout predictions: `2026-06-27 23:59 America/Sao_Paulo`
- champion/runner-up/third-place picks: same as group predictions

Users can edit drafts until they confirm or the deadline closes. Confirmed
prediction rows are protected by database triggers. Admin unlocks use an audited
override path and should be treated as exceptional support operations.

The public `Palpites` page lists active players, shows confirmed predictions,
and leaves blanks for unconfirmed or missing picks. Admin users cannot create
prediction submissions.

## Useful Commands

Development:

```bash
npm run dev
npm run build
npm run start
```

Quality gates:

```bash
npm test
npm run lint
npx tsc --noEmit
npm audit --omit=dev
```

Prisma:

```bash
npm run prisma:validate
npm run prisma:generate
npx prisma migrate dev
npx prisma migrate status
npm run prisma:seed
```

Worker:

```bash
npm run worker -- all
npm run worker -- static
npm run worker -- live
npm run worker -- finalize
npm run worker -- standings
npm run worker -- open-knockout
```

## Worker Commands

- `all`: run the full local sync cycle.
- `static`: sync teams and matches from local OpenFootball data.
- `live`: attempt live-match sync; safely skipped without a live provider.
- `finalize`: recompute scores/leaderboard for finished matches.
- `standings`: attempt official standings sync; safely skipped without a provider.
- `open-knockout`: enable knockout predictions once Round-of-32 teams are resolved.

## Testing And Verification

Before handing work off, run:

```bash
npm run prisma:validate
npx prisma migrate status
npm test
npx tsc --noEmit
npm run lint
npm run build
npm audit --omit=dev
```

For route smoke tests with the dev server running:

```bash
curl -I http://localhost:3000
curl -I http://localhost:3000/matches
curl -I http://localhost:3000/rules
curl -I http://localhost:3000/predictions
```

Admin pages require login as an admin user.
Admins can generate a 24-hour password reset link from `/admin/users`; the link
opens `/reset-password` so the player can set a new password without the admin
handling a temporary password.

## Production-Like Docker Compose

The production scaffold uses:

- `Dockerfile`
- `docker-compose.prod.yml`
- `.dockerignore`

It defines `web`, `worker`, `migrate`, and `postgres`. App services do not bind
host ports. The `web` service exposes internal port `3000` to an external Caddy
network named `public_proxy`.

Validate the Compose file locally:

```bash
AUTH_SECRET=local-check-secret \
APP_URL=http://localhost \
DATABASE_URL='postgresql://bolao:pw@postgres:5432/bolao_copa_2026?schema=public' \
POSTGRES_DB=bolao_copa_2026 \
POSTGRES_USER=bolao \
POSTGRES_PASSWORD=pw \
docker compose -f docker-compose.prod.yml config --quiet
```

To run the production scaffold locally, create the external proxy network and a
prod env file:

```bash
docker network create public_proxy
cp .env.example .env.production
```

Then update `.env.production` for the Compose database host:

```env
POSTGRES_DB=bolao_copa_2026
POSTGRES_USER=bolao
POSTGRES_PASSWORD=troque-esta-senha
DATABASE_URL=postgresql://bolao:troque-esta-senha@postgres:5432/bolao_copa_2026?schema=public
AUTH_SECRET=troque-por-um-segredo-longo
APP_URL=https://bolao.parmezani.com
PRIMARY_DATA_PROVIDER=openfootball-static
WORKER_INTERVAL_SECONDS=300
ADMIN_EMAIL=admin@bolao.parmezani.com
ADMIN_DISPLAY_NAME=Admin
ADMIN_PASSWORD=troque-esta-senha-admin
EMAIL_FROM="Bolão dos Facabundos <noreply@bolao.parmezani.com>"
RESEND_API_KEY=re_xxx
```

Build and start:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up
```

Because `web` does not publish a host port in this Compose file, access it
through a Caddy container attached to `public_proxy`, or add a temporary local
override if you need a direct localhost port.

## VPS Handoff

The final host is expected to be:

```text
bolao.parmezani.com
```

The target VPS alias is `parmavps`. Before doing any deploy, SSH, Caddy reload,
service restart, or production debugging on that host, read the local VPS
deployment rulebook in the OpenClaw workspace and follow it.

Expected Caddy route:

```caddyfile
bolao.parmezani.com {
    encode zstd gzip
    reverse_proxy bolao-copa-2026-web:3000
}
```

Production assumptions:

- external Docker network `public_proxy` already exists;
- only `web` joins `public_proxy`;
- `postgres` and `worker` stay isolated on the project default network;
- `migrate` runs `prisma migrate deploy` before `web` and `worker`;
- `worker` runs `npm run worker -- all` in a loop using `WORKER_INTERVAL_SECONDS`.

## Notes For Agents

- Read `docs/tech-spec.md` before changing behavior.
- Keep changes local-first unless explicitly asked to deploy.
- Update docs when setup, commands, architecture, APIs, configuration, or behavior changes.
- Do not weaken prediction immutability; use audited admin override paths only.
- Run the verification checklist before claiming a milestone is complete.
- Do not commit secrets or local `.env` files.
