# Deployment and operations

## Provisioned resources

| Service | Dedicated resource | Configuration |
|---|---|---|
| Cloudflare | Worker `neylo`; account `edda2b12d52321e4df2012e196b33640` | Workers Free; apex and www custom domains |
| Cloudflare DNS | Zone `764d6c46d80d8871f455b1b73d8aeb9d` | Active Free zone; approved nameservers elias.ns.cloudflare.com and tara.ns.cloudflare.com |
| Supabase | `neylo`, project `tfphopejudgbfrucdxsy` | Free, Ireland, Postgres 17; ordered migration history in the repository |
| Resend | `notify.neylo.xyz`, domain `7d157752-07fd-4d41-a584-d2da09b505b0` | Verified domain and sending-only key restricted to this subdomain |
| Namecheap | `neylo.xyz` | Registration retained; no transfer |

The inspected Workers Free allowance is 100,000 requests/day, 10 ms CPU/request, 50 subrequests/request. This is a quota-limited launch deployment. No payment or automatic plan upgrade was authorized. Supabase and email limits can throttle bursts; do not disable verification or invent successful signup on throttling. Supabase SMTP is configured for 100 messages/hour globally and 60 seconds per recipient. Resend Free allows 100/day and 3,000/month across this provider account; 4 emails had been used at the final inspection (96 daily remaining). These are email counts, including retries and sign-in codes, not unique-account quotas. Pay-as-you-go remains disabled. No paid backup, uptime monitor, or guaranteed service level is claimed.

## DNS and transport

The exact initial DNS is recorded in `dns-before.md`. Root Namecheap email-forwarding SPF and five MX records were retained. Parking www and the apex URL redirect were replaced by the application custom domains. Resend's exact provider-returned DKIM, return-path and verification records are in `../ops/neylo-dns.zone`. The user explicitly approved DNS delegation; unrelated infrastructure was preserved.

HTTPS is active. HTTP and www redirect permanently to `https://neylo.xyz`, preserving path and query. The Worker rejects alternate production hosts by canonical redirect. Private paths and API responses are not shared-cacheable. CSP, HSTS, frame denial, nosniff, referrer and permissions policies are applied by the outer Worker. Test both HTML **and its referenced CSS/JS assets** after each deployment.

## Authentication and email

Supabase Site URL is `https://neylo.xyz`; the exact account redirect is `https://neylo.xyz/account`. Email confirmation is required; anonymous/provider alternatives are disabled. OTP codes have six digits and expire after 900 seconds. Signup and sign-in templates use the provider's `{{ .Token }}` value and no authentication link. Template source: `../supabase/templates/code.html`.

SMTP: `smtp.resend.com`, port 465, username `resend`, sender `no-reply@notify.neylo.xyz`, name NEYLO. The restricted SMTP key lives in Supabase's protected SMTP settings. Public support is the separately monitored `kerim@horalix.com`. Real messages reached the owner-controlled Horalix and Gmail inboxes and their supplied codes were verified through the provider.

## Secrets and building

Production Worker secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RATE_LIMIT_SECRET`. The service key is the project's legacy service-role key and remains server-only. Supabase provider session cookies are secure, HttpOnly and SameSite Lax in production. Pending-claim and recent-admin-auth cookies have separate purposes.

The authorized deployment machine has ignored `.env.production.secrets.json`, `.env.cloudflare-auth.json`, and `.env.resend-smtp.json`. Do not upload these, test-session cookies, or OTP files. Recreate them from the provider's secure settings on a new machine; never copy keys into documentation or chat. Wrangler authentication is separate from Worker runtime secrets.

`npm run deploy:vinext` runs `ops/build-production.ts`, which checks the exact Supabase project, then runs Wrangler against `dist/server/wrangler.json`. The root `wrangler.jsonc` preserves both custom domains and public nonsecret variables. Keep production and local Supabase values separate. Runtime secrets can be set using Wrangler secret commands with input through stdin or an ignored JSON file. The build does not publish or migrate the database automatically.

## Migrations and recovery

Apply unapplied SQL files in `supabase/migrations` in order to the intended project using the Supabase CLI or SQL editor, and record their versions. Compare against `supabase_migrations.schema_migrations` first; do not reapply the combined fresh-schema script to an existing project. `ops/bundle-migrations.ts` creates a bundle for a **fresh** project only. Generated database types are in `src/lib/database.generated.ts`.

New reward issuance ended on 13 September 2026 while signup stayed open. Migration 009 supplies the permanent cutoff guards; `ops/end-rewards.sql` performs the audited closure and policy publication. Existing ledger entries are preserved. Applying the structural migration alone does not close rewards. See [waitlist release](waitlist-transition.md) for the exact cutoff, checks and historical-policy behavior. An application rollback must retain compatible waitlist copy and must never advertise a closed promotion.

Database operations are transactional. Recovery from an interrupted browser completion is an idempotent finalization call with the same pending cookie and verified provider account. Expired holds require selecting an available handle again. Reversals append negative ledger entries; they never edit grants or reopen consumed campaign/referral slots.

To pause enrollment, sign in as the operator, open `/admin/operations`, perform its recent-authentication step, and use the campaign control with a reason. Review, classification, reversals and deletion handling also require a recent code verification and produce audit entries. Judge/presenter membership cannot perform these mutations. A hidden URL alone grants no access.

Owner bootstrap is deliberately restricted to the verified `kerim@horalix.com` identity. `ops/prepare-owner.ts` creates only an unconfirmed identity and staff tag; `ops/bootstrap-owner.ts` refuses unverified ownership. Do not bootstrap a second arbitrary administrator or auto-confirm a production test account.

For application rollback, use `npx wrangler deployments list --name neylo`, select an observed known-good version, then `npx wrangler rollback <version-id> --name neylo`. Preserve current secrets and DNS. Pause enrollment first when business behavior is uncertain. Database migrations are forward-only in this release: make a reviewed corrective migration, not an ad hoc deletion of ledger rows. Backups/restore drills have not been configured or claimed.

## Health, reconciliation and privacy

- `/api/health` is public liveness without credentials or database details.
- `/api/admin/readiness` and `/api/admin/reconcile` require admin authentication.
- `/admin/validation` and `/judge` share aggregate definitions and the CSV export implementation. UTC filters are explicit; display timestamps use Europe/Sarajevo.
- Staff, test and compensated accounts are excluded by default; independent and founder-assisted participants are distinct cohorts. Lifetime totals are labeled separately.
- Errors return an opaque request ID. Server logs omit OTPs, cookies, credentials, raw contacts and payloads. Use Wrangler tail only when investigating and redact any unrelated provider output.
- Account deletion requests are stored and appear in the operator queue. The operator must process requests through the documented retention workflow; no automatic data erasure is claimed.
- Optional analytics is consent-based. No measured anonymous-visitor denominator is claimed, and email control is not proof of a unique human.
