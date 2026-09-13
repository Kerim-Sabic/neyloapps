# Operator-attested account imports

An import is an administrative record of previously verified participants. It is
not evidence that NEYLO delivered or checked an OTP for them. Keep the operator's
attestation, original completion time and actual import time in the audit trail.

`ops/account-import-sql.ts` validates a batch of verified Supabase Auth identities
and produces one reviewable Postgres transaction. The input is `{batch, actor,
rows}`; each row contains `user_id`, `handle`, `email`, `completed_at`, `cohort`
(`independent`) and `source`. Supply normalized input and ISO UTC timestamps.
Personal data and generated SQL belong in ignored `work/`, never in Git.

Before importing, check all handles, active holds and existing email identities.
Use Supabase Admin Auth to create missing passwordless identities only after
explicit verification attestation. Store the attestation provenance in protected
`app_metadata`. `createUser` with `email_confirm: true` is an administrative
confirmation; it does not deliver an email or establish a user login session.
Do not send invitations or generate impersonated login sessions for validation.

Apply migration `202609130007_imported_consent.sql` and deploy the matching account
view before importing records with missing campaign consent. Then run the
generated transaction using the project's authorized SQL connection/editor. The
transaction requires a verified operator and verified, matching Auth identities.
It preserves live handle holds, serializes with normal completion, and reserves
each handle through the same unique registry. Conflicts roll back the entire
profile import. Auth identity provisioning is a separate provider operation;
retain its ID mapping so an interrupted operation can resume safely.

Each imported account receives a profile, enrollment and invitation code so
ordinary passwordless sign-in and the existing account query continue to work.
Without recorded consent and eligibility evidence, `accepted_at` stays null and
eligibility stays `review_required`. No founding capacity, credits, referral
relationships, marketing consent, analytics consent or pilot interest are added.
An `invitation` source alone does not identify an inviter or establish a reward.
Database checks prevent eligibility approval while acceptance is missing.

The profile's `campaign_tag`, immutable per-account `account_import` audit record,
and durable batch idempotency result identify the administrative import. Supplied
completion timestamps are preserved; Auth confirmation and audit timestamps are
actual operation times. A repeated identical batch is a no-op. A changed payload
under the same batch key fails.

Validate every account through `neylo_account`, compare the input to operator
account-list results, confirm all financial counters and existing records are
unchanged, and run `neylo_reconcile`. The targeted test is:

```
node node_modules/tsx/dist/cli.mjs tests/database/account-import.ts
```

It runs only against local Supabase and rolls its fixtures and migration back.
The operator dashboard includes attested imported participants in completed
account totals; eligibility-review counts remain separate from founding credits.
