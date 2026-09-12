# NEYLO architecture

Next.js App Router and TypeScript run on Cloudflare Workers through vinext and the Cloudflare Vite adapter. Supabase supplies managed Postgres and provider-managed email OTP. Resend supplies verified SMTP on notify.neylo.xyz. The dedicated services are provisioned and the apex and www custom domains are attached. Vercel Hobby was inspected and left unused because this launch is commercial. No service was purchased or upgraded.

The essential complexity is coordination: verified identity is separate from committing a handle, campaign place, and referral entitlement. The server obtains a fresh Supabase Auth user; a service-only Postgres function independently checks auth.users, the pending token hash/contact binding, hold expiry, immutable accepted rules, and existing completion before committing all business effects.

Finalization and review lock campaign_state first, then pending/handle, then referral/enrollment records. This deliberately serializes a 100-founder launch campaign: a small, auditable transaction is preferable to distributed counters. Email happens outside transactions. Unique source keys and consumed referral slots make retries harmless, including after a reversal. Amounts are integer BAM minor units; totals derive from immutable entries.

All 17 exposed tables use RLS. The client cannot call privileged functions, write roles, or grant rewards. Next route handlers validate bounded input, same-origin mutations, authentication, and explicit admin membership. A presenter can read aggregates and export the same aggregates only. Every API response and private HTML page is private/no-store. The pending-claim secret is a random HttpOnly cookie; Supabase SSR handles provider session cookies. The outer Worker enforces canonical redirects and security headers on streamed framework responses, and explicitly serves /_next/static through the ASSETS binding.

Production fails closed when database, custom SMTP, reviewed terms, or operator information is missing. Preview UI never creates synthetic accounts or hard-coded account balances. Local database fixtures live only in a disposable test database.
