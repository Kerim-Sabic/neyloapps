# Next step: a real two-account local pilot

## Decision and completed scope

The next launch dependency was proving the existing application against actual authentication and durable storage. Adding more currencies or a simulated wallet would not close that gap.

This delivery runs the real signup and email-OTP handlers, Supabase Auth, PostgREST and PostgreSQL. No browser request interception, fabricated session, fake OTP or bypass endpoint is used. The only fictional elements are the users and bank details. No bank or payment provider is connected.

## Try it

Prerequisites: Node 22+, Docker running, dependencies installed (`npm ci`), and Chromium installed for tests (`npx playwright install chromium`). Stop another Neylo process on port 3100 first; the test runner deliberately refuses to reuse an unknown server.

```sh
npm run pilot:setup
npm run pilot:local
```

Open http://127.0.0.1:3100. The **LOCAL PILOT** banner identifies this environment. Create a unique username with an email such as `yourname@example.test`. Open the local inbox at http://127.0.0.1:55424 to get the actual verification code. Email is captured locally, not sent through production SMTP.

1. Create account A and verify its email.
2. Open **Set up receiving account**. Use fictional holder/bank names and the illustrative test IBAN `BA391290079401028494`. Never send money to it.
3. Save privately, then opt in to username lookup.
4. In a separate browser profile/private window, create account B with another `.test` email. Look up account A by handle under **Pay by username**.
5. Prepare instructions, change account A's currency/details, check stale revisions are refused, then opt out or remove its receiving account.

You can use supported international fixtures from `src/features/payments/bank-formats.json` for testing. They are examples, not real recipients.

The runner only accepts this project's fixed local API/database/mailbox addresses. It passes configuration through child-process environment variables; it creates no `.env` file or production secret. It initializes only a draft or existing local-pilot campaign, closes promotional rewards and never resets/truncates a database. Other campaign state causes a refusal. Fictional accounts persist locally across runs. Restarting the runner rotates its local recent-auth signing key, so sensitive edits may require signing in again.

## Repeatable acceptance test

```sh
npm run pilot:test
```

The test creates two fresh users through the real UI and local email verification, then checks:

- Receiving details survive a save and remain private until sharing is enabled.
- A second user sees only their own settings; lookup initially returns masked metadata.
- Sender prepares the saved IBAN by @handle without entering account numbers.
- Destination changes invalidate an older revision.
- Injected identity fields, cross-origin writes and missing recent authentication are rejected.
- Opt-out stops discovery and deletion removes the saved destination.
- Sign-out followed by a fresh real OTP sign-in returns to receiving-account setup.
- Bank execution remains disabled and no promotional credits are created.
- The receiving settings screen passes automated WCAG AA checks.

The suite takes around 70 seconds locally because it respects the provider's real OTP resend cooldown. It writes a sanitized checklist to `test-results/pilot/summary.json`. Authentication traces, videos and automatic screenshots are disabled so session cookies and OTP payloads do not become CI artifacts. GitHub Actions now runs this separate integration job in addition to the fast unit and browser checks.

## What was verified here

All migrations applied to actual local PostgreSQL. Supabase database advisors returned **No issues found**. Full database types were regenerated from this schema, replacing the earlier hand-added RPC declarations. This is local integration evidence; it is not hosted staging, bank certification, an independent penetration test or permission to collect real financial data.

The application binds to 127.0.0.1. Setup also requests a dedicated Docker network with a loopback binding option, following [Supabase's local-development guidance](https://supabase.com/docs/guides/local-development). However, this Windows Docker host reports the Supabase service ports on all interfaces despite that option. Treat Docker's actual published-port configuration as authoritative: use this only for fictional data on a trusted development machine, verify the host firewall/bindings, and stop the stack after testing. The runner does not alter global Docker settings or other projects.

Stop the app with Ctrl+C. Stop just this Supabase project while retaining its data with:

```sh
npx supabase stop
```

Do not use `db reset` or `--no-backup` to troubleshoot this pilot. To regenerate types on the custom network, use `supabase gen types typescript --local --network-id neylo-local-pilot` and validate output before replacing the generated file.

## Next release gates

| Gate | Status | Acceptance criterion |
| --- | --- | --- |
| Real local two-user journey | Implemented and locally verified | UI → OTP → API → PostgreSQL → second authenticated user |
| Hosted staging | Still required | Dedicated staging project, migrations/advisors, production-like cookie/security settings, two staged users, operator-approved privacy and retention policy |
| User research pilot | After staging | 5–10 invited participants; measure completion time, setup failures, wrong-recipient risk and comprehension of bank authorization |
| Live BAM transfers | External dependency | Approved partner scope, recipient verification, funding/payout proof, reconciliation/support readiness and explicit live-money activation approval |
| International execution | Later | Separate legal/entity/residency, funding, FX and payout approval for each corridor |

No hosted project, public deployment, privacy approval or live-money activation is included in this delivery. Production configuration remains gated.
