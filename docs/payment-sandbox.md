# Run and review the payment sandbox

This is an **end-to-end local contract simulator**, not a bank/provider sandbox integration. No provider account, bank connection, production identity or real money is used. It deliberately runs separately from the existing Next.js app and the presentation demos. It uses the repository's existing TypeScript, Zod and PGlite dependencies; no dependency was added.

## Run

From the repository checkout, with Node 22 or newer:

```text
npm ci
npm run sandbox:payments
```

Open `http://127.0.0.1:3210`. It binds only to loopback, validates Host and mutation Origin, uses an HttpOnly local fixture session, limits request bodies and refuses production-stage startup. Do not tunnel or deploy it. It creates an isolated persistent database under ignored `work/payment-sandbox/database`; it does not read Supabase/payment credentials or modify existing databases.

1. Enter 50.00 BAM and create Alice's transfer to fixture recipient @bob.
2. Confirm simulated funding. Status becomes payout pending; Bob has received nothing yet.
3. Choose **Lose payout response**. The simulated provider executes once but Neylo shows unknown. Reconciliation exposes a 5,000-minor-unit difference.
4. Choose **Recover original payout**. The original provider reference is recovered; the transfer completes and reconciliation matches at zero difference.
5. Use **Start a separate transfer**, create another intent and fund it. Reject the payout, then confirm its refund. Until refund confirmation, the payable remains outstanding.
6. Restart the process and reopen the same browser. Persistent state survives; the local session rotates. Repeated submission of the saved intent reuses its idempotency key. Choose a separate transfer explicitly to generate a new key for the same amount.

Only 0.01–100.00 BAM and @bob are fixture-supported. The simulator charges zero fees; this is not a commercial quote. The UI is an engineering demonstration rather than the finished payment product. Alice/Bob/KYC/ownership are fixtures, not production authentication or verification.

## Implemented

- Persistent transfer intent, immutable destination and integer BAM amounts.
- Concurrent duplicate-intent protection and payload conflict rejection.
- Raw-body HMAC webhook authentication, timestamp tolerance, event deduplication and amount/currency/reference binding.
- Funding and confirmed recipient credit are separate events.
- Transactional inbox, state, paired debit/credit journal and outbox writes.
- Append-only journals and audit records protected against update/delete.
- Separate durable simulated provider outcomes, including execution before response loss.
- Original-reference recovery, definitive payout failure and independently confirmed refund.
- Control-ledger reconciliation against simulated provider cash and pending liabilities.
- Real HTTP transport and a small browser UI; no production route or deployment changes.

## Verification

```text
npx next typegen
npm run check
npm run test:payments
```

The repository's type-generation command can regenerate `next-env.d.ts` for native Next.js; its production adapter uses a different generated type path. That generated file is not part of this payment change.

The new suite has eight explicit subcases plus its parent test: concurrent/idempotent requests and ownership, signature/event/order rejection, persistence and payout uncertainty, refunds, immutable/balanced journals, injected transactional failure, real HTTP authorization/body limits and full money flow, and live-mode rejection. These add to the preexisting 46 checks. Browser verification exercised 50 BAM funding → lost response → recovery → confirmed recipient credit and zero reconciliation difference.

## Not implemented or proven

No provider-specific API, real KYC, bank-account ownership verification, passkey/step-up flow, live refunds, chargebacks/returns after completion, fee allocation, FX, recipient claims, sanctions/risk engine, statements from a real bank or production operator interface. The outbox is driven manually by local controls rather than a background production worker. Out-of-order events return errors; a production inbox needs durable quarantine/replay. The HMAC protocol is illustrative and must be replaced with the partner's exact signature contract.

PGlite serializes local transactions and is not evidence of multi-process PostgreSQL locking behavior. Simulated bank records and application records occupy separate tables in one local database: this cannot reproduce independent network/database partitions. The limited paired journal guarantees equal debit/credit by construction, but is not a complete chart of accounts or a deployable wallet ledger. No row-level multi-user API is deployed. Local session, local storage and test controls are intentionally not reusable production identity/security mechanisms.

The next integration must demonstrate the same tests with independent partner sandbox state, real Postgres concurrent workers, lost/duplicate/out-of-order webhooks, expired provider keys, mismatched statements, settlement returns and restore/replay. Access and commercial approval are blocked pending a partner; inventing an Adyen/Monri approval or API contract would be misleading.

See `docs/bam-launch-decision.md` for the research, provider comparison, architecture, economics, exact partner questions and approval gates.
