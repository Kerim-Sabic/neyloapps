# Presentation release — 13 September 2026

The pitch and product experiences are deployed to the existing NEYLO Cloudflare
Worker at `/pitch`, `/app/demo`, `/demo/nadin` and `/demo/kerim`.

## What changed

- A projector-first pitch with a light sapphire canvas, dark text, stronger
  typography, a Sapphire toggle and eleven chapters totaling three guided minutes.
- A concrete pain-to-product story, an interactive before/after example, sourced
  2026 modernization milestones, and interactive 1-, 5- and 10-year horizons.
- Layered CSS 3D material, milestone reveals, shared layout selection, consistent
  motion timing, reduced-motion controls, keyboard navigation and speaker notes.
- The bare Nadin and Kerim URLs automatically resolve to one public presentation
  room. Private pairing remains available for a separate rehearsal.
- A fully tappable contact row, clearer mobile text, a wider desktop device on
  short viewports, shared contact-avatar motion, and a receipt that resolves as
  the same route folds back into its endpoints.
- A 200-transfer rehearsal bound that preserves idempotency for every stored send.

The implementation stays in `src/features/pitch` and `src/features/demo`.
`story.tsx` contains the new narrative interactions; `content.ts` owns chapters
and sources. `shared/room-worker.ts` resolves public/private rooms, `use-room.ts`
subscribes to canonical state, and `machine.ts` handles the routing app's
completion transition. No database migration was added.

## Verification actually run

| Check | Result |
| --- | --- |
| TypeScript and unit/isolated SQL suite | 46 passed, 0 failed |
| Production build | Passed with the pinned vinext/Cloudflare adapter |
| Public stage integration | 6 checks passed locally and on production |
| Private session integration | 5 checks passed locally |
| Production pitch/metric boundaries | 7 checks passed |
| Production route and asset checks | 9 pages and 42 assets passed |
| Routing route isolation | Route, 28 referenced assets, homepage and private admin boundary passed |
| Production browser errors | None observed on pitch, Nadin or Kerim |

The public integration test starts five concurrent confirmations and proves
they resolve to one UUID. Independent HTTP clients obtain the same incoming
record and receipt. The canonical completion offset is exactly **15,000 ms**;
the UI additionally depends on network delivery and polling. A retry after
arrival keeps the original record. The private-room test additionally checks
cross-origin rejection, forged input rejection and room isolation.

Browser work included:

- Nadin at `127.0.0.1` and Kerim at `localhost`, which have independent cookies
  and browser storage, plus both exact production routes in separate tabs.
- A production 25 KM send producing 24.90 KM for Kerim and the same
  `NEY-8A129C1C` reference on both screens. Refresh restored the receipt.
- An 18-second capture of the incoming journey, route expansion, collapse and
  arrival, saved as `neylo-connected-arrival.gif` in the delivered evidence.
- 360, 390, 430, 768 and 1440 px routing layouts; 390 px mobile pitch; 1280×720
  projector framing and 1440×900 desktop pitch. No horizontal page overflow.
- Contact filtering, zero rejection, 100/200 quote calculation, Fastest selection,
  Advanced focus return, pause, refresh, resume, guided completion, manual
  interruption of guided playback, local cost/speed selection and receipt folding.
- Rendered connector geometry: every expanded connector began and ended exactly
  8 px from its adjacent circle. Reopening the completed route preserved progress.
- Roadmap keyboard selection, mobile speaker-note semantics, Escape dismissal,
  focus return, both pitch palettes and reduced motion. Decorative animation
  was `none` with reduced motion enabled.

The production aggregate remained **80 registrations: 10 verified through NEYLO
and 70 operator-attested imports**. The UI retains that distinction. These are
not active users or payment volume. Waitlist enrollment remained open, new
reward issuance remained closed, and private account endpoints still required
authentication.

## Practical limits

This was browser and HTTP-client testing, not physical iPhone/Android or physical
projector testing. A real mobile software keyboard and browser 200% zoom were
not retested in this release. No real financial execution, bank confirmation,
audio hardware or physical-camera QR test was performed in this pass. Failure,
expiry, stale callback and other recovery cases are also covered by the unit suite.

The public presentation room is intentionally shared by all visitors to the two
bare URLs. It changes with the UTC day and retains its synthetic records until
expiry. Use a private pairing link for a separate session. Bank/provider
integrations remain the next product milestone; the presenter must verbally
disclose simulated execution.

No acquisition account, referral, entitlement, authentication configuration or
DNS record was changed for this release. The existing domain and managed backend
remain in place. See [the presenter guide](presentation-guide.md) for the sequence.
