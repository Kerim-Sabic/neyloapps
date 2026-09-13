# Waitlist release — 13 September 2026

Public enrollment remains open at https://neylo.xyz. The homepage now invites
people to join the waitlist and reserve a handle. New welcome and referral
rewards ended at **2026-09-13 10:17:16 UTC**, following the owner's instruction.
The card, signup controls, account invitation copy and current terms agree with
that change. Existing earned entitlements and their accepted historical terms
remain available in the account.

## Database boundary

Migration `202609130009_waitlist_rewards.sql` separates enrollment availability
from a permanent reward cutoff. Completion, referral qualification, direct grant
insertion and closure acquire the same campaign-row lock. After closure, verified
participants still receive a completed profile, reserved handle and invitation;
they receive no new founder allocation or credit grant. Delayed reviews cannot
create awards. Pausing and reopening enrollment cannot restart the promotion.

`ops/end-rewards.sql` publishes the new waitlist policy and closes rewards in one
audited transaction. It compares the complete credit ledger before and after the
change and fails if any historical row or founder allocation changes. It is
idempotent. `ops/prepare-waitlist-closure.ts` regenerates that reviewable SQL from
the policy source; it does not execute a remote change.

In production, all **16 existing ledger entries** were identical across closure.
All five reconciliation invariants passed, enrollment remained open, and no new
grant existed after the cutoff at the verification snapshot. Reversals remain
append-only, authorized and audited. Previously accepted policies can be viewed
through `/terms?version=...`; unfinished claims must accept the current version.

## Launch-day README count

The UTC window is `[2026-09-12 00:00, 2026-09-13 00:00)`. Production records show
**80 participant accounts** with completed profiles and confirmed identities:
10 completed through NEYLO and 70 imported with the operator's verification
attestation. Staff, test and unfinished attempts are excluded. The import's
supplied completion time is distinct from its actual administrative import time.
This is a dated waitlist-account count, not a claim about active users, unique
humans, payment activity or emails independently verified by NEYLO for imports.
The README links to current public aggregates without embedding private data.

## Verification

- `npm run check`: TypeScript and **43 passing tests**, including the new
  waitlist transaction tests using isolated PGlite fixtures.
- `npm run build:production`: successful Cloudflare production build.
- Local tests cover closure idempotency, unchanged historical credits, consent
  refresh, repeated finalization, direct and invited completion without rewards,
  delayed review, direct grant rejection, cutoff immutability, permissions,
  historical policies and legitimate reversals.
- Production inspection confirmed the cutoff, open signup, unchanged ledger
  fingerprint and all reconciliation checks. Read-only smoke checks cover the
  homepage, terms, existing demo/pitch routes, static assets and private APIs.
- Desktop and mobile browser inspection checks the published waitlist layout,
  immediate handle preview and absence of the prior promotion.

No new real participant, email delivery or financial transaction was created to
test this release. Multi-connection Postgres race testing was not rerun because
the local Postgres service was unavailable; PGlite retries and lock review do not
substitute for that test. Physical devices and OS keyboards were not tested.

## README artwork

`python ops/render-readme.py` regenerates the original hero after `npm ci`.
It needs Pillow, uses the installed Geist font and produces a compact GIF plus a
static PNG. Motion plays twice and settles; all information remains available in
the adjacent Markdown. No external image service, tracking pixel, remote font or
script is required to render the README.
