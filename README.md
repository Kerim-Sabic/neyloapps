# NEYLO

The deployed early-access identity and referral product at **https://neylo.xyz**.

Next.js App Router / React / TypeScript, Cloudflare Workers, managed Supabase Postgres and email OTP, and Resend SMTP. The card is a real responsive component. Accounts, handles, invitations, and promotional entitlements are server-authoritative.

## Production

- App: https://neylo.xyz
- Account / sign-in: https://neylo.xyz/account and https://neylo.xyz/signin
- Private validation: https://neylo.xyz/admin/validation
- Authenticated aggregate presentation: https://neylo.xyz/judge
- Owner: `kerim@horalix.com`, operator membership established only after real provider email verification.
- Operator: Horalix d.o.o., Maglajska 1, Sarajevo, Bosnia and Herzegovina.

The first 100 eligible verified founding accounts receive 100 KM in reserved launch fee credits. Each eligible founder can earn three 50 KM referral grants, up to 250 KM total. Sharing or opening an invitation earns nothing. Credits are not cash or spendable funds. Published rules are versioned in Postgres; the owner approved `founding-v1`.

## Local development

Use Node 22 or newer, npm, and Docker Desktop. Install the exact lockfile:

```sh
npm ci
npx supabase start
npx supabase status --output json > .env.local-status.json
```

The helper below reads the ignored local status file and writes `.env.local` and `.dev.vars` with the local URL/keys, a new random rate-limit secret, and approved campaign configuration. The local readiness flags enable Mailpit capture only, not external delivery. Do not use production keys for local testing. `.env.example` documents all configuration fields for manual setup.

```sh
npx tsx ops/prepare-local.ts
npm run dev
```

Local app: http://127.0.0.1:3100. Local Supabase: http://127.0.0.1:55421. Mailpit: http://127.0.0.1:55424. Postgres port: 55422. `prepare-local.ts` refuses to change a database with completed accounts.

## Checks

```sh
npm run typecheck
npm test
npm run test:db
```

**The database suite resets the isolated local fixture.** It rejects non-local database targets. Run it before creating manual browser test accounts. It exercises actual Postgres transactions, concurrency, retries, RLS, permission boundaries, exclusions, reversals, and deletion workflows. Five focused unit tests cover parsing, money formatting, input boundaries and filters.

Browser verification uses real local provider OTPs captured by Mailpit in two separate cookie origins (`127.0.0.1` and `localhost`). `ops/capture-browser-data.ts` reconciles those completed records and CSV totals; it is a local-only evidence helper, not a simulated production signup. See [verification](docs/verification.md) for exact coverage and limitations.

## Deployment and operations

See [runbook](docs/operations.md), [architecture](docs/architecture.md), [reference audit](docs/reference-audit.md), and [implementation checklist](docs/implementation-checklist.md).

The production adapter is vinext with the Cloudflare Vite plugin. Native Next development is the default. The adapter is beta: keep the lockfile pinned and run the production-origin smoke checks after upgrades.

```sh
npm run deploy:vinext
```

This explicitly builds with the intended managed backend and deploys that exact artifact through Wrangler. Never replace it with an implicit rebuild using local environment values. No production secrets are committed. This repository's CI validates source; deployment is an explicit authenticated operator command.

There are no live transfers, issued payment cards, or spendable wallets in this release.
