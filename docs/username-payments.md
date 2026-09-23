# Usernames first. Bank details once.

## What changed

The default `/pay` journey now asks for **@username**, not an IBAN. An account owner adds their personal BAM receiving account once in **My account → Set up receiving account** (`/account/receiving`). The destination is bound to their authenticated profile ID and existing reserved handle on the server. Users cannot supply another person's profile ID or claim a different username in this form.

The owner supplies account-holder name, Bosnian IBAN, bank selection (or a custom bank name), and optional SWIFT/BIC. The app checks IBAN structure/checksum and BIC syntax; it does not verify ownership, existence or that the selected bank matches the IBAN/BIC. No guessed bank-code mapping is used. The bank list is a convenience selector based on [CBBH](https://www.cbbh.ba/content/read/7), not a coverage directory. Automatic bank identification should use a maintained, verified directory later.

Only domestic BAM bank instructions are supported. Additional international addresses, correspondent banks, card funding, wallet routes and currencies are intentionally not collected or advertised without an approved route that requires them.

## Owner journey

1. Create/verify the existing Neylo account and reserve a handle.
2. Open receiving-account setup. This is optional, not a condition for reserving a name.
3. Save receiving details and explicitly choose whether signed-in people can find them by exact username. Sharing is off by default.
4. Update, disable discoverability or remove the destination later. Save/remove requires a sign-in within the last 10 minutes; changes carry a revision token to prevent accidental stale overwrites.

One account per user is supported in this first version. It remains `self_declared`, never `verified`. Saving a destination does not link a bank login, create debit permission or grant Neylo access to a balance.

## Sender journey

1. Enter the exact @handle. No fuzzy search or public recipient directory.
2. See the recipient's supplied account-holder name and handle. Expand the receiving route to see bank, BAM currency and last four account digits.
3. Enter amount and review. Bank numbers are not typed by the sender.
4. On preparation, the server rechecks opt-in and destination revision before returning complete bank instructions. Changes/removal cause a retry, not silent redirection.
5. Authorize separately in the sender's bank app. Neylo still cannot execute or confirm the transfer. The manual-entry planner remains an explicit fallback for recipients without a saved route.

Because no payment provider is connected, account details still appear in final bank instructions so users can finish in their bank. Once an approved execution adapter exists, it can use the server-held destination and keep the main send journey focused on the username. Route expansion must describe only real available methods, not speculative card/wallet options.

## Security and privacy

- Destination table has RLS and no grants to anonymous/authenticated client roles. There are no publicly callable security-definer functions. A service-only invoker RPC is called by server handlers after fresh authenticated account checks.
- Both lookups and full instruction preparation are authenticated, rate limited, same-origin POSTs with bounded JSON and no-store responses. Full bank numbers do not travel in query strings or initial lookup responses.
- Owner explicitly consents to sharing account name, bank and masked digits with exact-handle requesters, and full instructions with senders preparing payments. This is not secrecy from those authorized recipients; they can copy/export instructions.
- Update/remove requires recent authentication. Client payloads cannot set verification status, identity, user ID or handle ownership. Old destination revisions are rejected.
- Save/remove/reveal events are recorded without bank numbers in the event table. Service-role operators still have database access; this is not application-level encryption. Hosting/key-access/backup controls and an updated operator privacy notice need review before collecting real bank data.
- Removing a destination stops new lookups/reveals, but cannot revoke instructions already downloaded. Profile deletion cascades to destinations/events; the existing account-deletion request workflow is not itself immediate erasure.

## Enable on an environment

This delivery **does not apply the migration or enable collection in production**.

1. Review `supabase/migrations/20260923224458_receiving_accounts.sql` in a staging Supabase project. Back up and review grants/retention before applying it through the normal migration process.
2. Keep existing authentication, same-origin and rate-limit configuration. Set server-only `RECEIVING_ACCOUNTS_ENABLED=true` only after the migration and privacy notice are ready.
3. Test with two actual staged authenticated users: owner saves/opts in; sender finds owner; stale revision fails; private/removed account cannot be found; owner signs in again before changing details.
4. Run Supabase security advisors and regenerate database types from that migrated environment. This branch includes the RPC type declaration; full hosted schema generation is still a staging task.
5. Deploy the application. This flag enables directory/instruction storage only; it cannot enable live money execution.

If the flag is absent, saving and lookup fail closed. The manual planner and reserved identities remain available. No secrets or real bank data are included in the repository.

## Review without accounts

`/pay/preview` is an explicitly labeled offline design preview. Enter **nadin**. It uses an illustrative account number and no receiving-account API, database, authentication bypass or real recipient. Do not send money to fixture details. It is separate from `/pay`, whose username lookups require real authentication and enabled storage.

## Validation boundaries

Database tests execute the actual migration in isolated PGlite with minimal profile/role fixtures: grants/RLS, consent, masked lookup, full reveal, revision conflicts, invalid IBAN and removal. Browser tests mock lookup/reveal responses to verify UI integration and changed-destination failure on desktop/mobile, and check the real unauthenticated API rejects requests. These tests are not a hosted Supabase integration test or bank certification. The staging checklist above remains required before public rollout.
