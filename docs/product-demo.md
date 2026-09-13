# NEYLO product experience

The additive `/app/demo` route is a public, isolated hackathon experience. **All external financial execution is simulated.** There are no bank/provider integrations, bank authentication, debits, payment confirmations, or actual funds in this feature. The presenter must explain that boundary verbally. As directed by the non-negotiable first section of the brief, the interface uses neutral “Journey complete” wording instead of the contradictory disclaimer/receipt labels requested later in the brief. Funding sources are explicitly labeled “Demo source.”

## Components and boundaries

- `src/app/app/demo/page.tsx`: additive route and no-index metadata.
- `src/features/demo/config.ts`: synthetic contacts, source eligibility, rational fixture FX rates, fees, limits, route nodes and delivery assumptions.
- `quote.ts`: decimal parsing, integer minor-unit calculations and route ranking.
- `simulation.ts`: cancellable playback clock, ordered node/connector events, pause/failure/completion model.
- `machine.ts`: guarded state transitions, confirmation deduplication, receipt history, stale-event rejection.
- `storage.ts`: validated, versioned `neylo:demo:v1` snapshot. Interrupted execution restores paused. Only the latest 20 completed receipts are retained on that browser.
- `presenter.ts` / `use-demo.ts`: state-aware guided sequence, manual interruption, cancellable subscriptions, page visibility, opt-in audio.
- `demo-app.tsx`: one persistent composer, sources, recommendations, review, tracking, receipt and presenter controls.
- `route-journey.tsx` / `route-geometry.ts`: stable DOM nodes and connectors, measured circle geometry, shared 8px gaps, interruptible unfolding.
- `bottom-sheet.tsx`: native modal dialog with contained keyboard focus, opener focus return, Escape/backdrop/close dismissal; positioned inside the desktop phone.
- `demo.css`: scoped sapphire design, mobile viewport/safe-area/visual-viewport support, desktop device shell and reduced motion.

The feature never imports the real account/referral/campaign services and makes no financial, signup, analytics or database requests. The existing root layout can still read the signed-in session and display-currency configuration. Existing app data, secrets, routing, DNS, email, authentication and campaign logic are unchanged. There are no migrations or new dependencies.

## Financial convention

“You send” includes the fee. Source and destination amounts use two decimal places. Fees equal fixed source minor units plus basis points of the total sent, with the variable part rounded upward. Conversion uses the remaining source amount and a rational FX rate, then rounds half-up to destination minor units.

| Scenario | You send | Fee | Recipient gets | Estimate |
|---|---:|---:|---:|---|
| Local bank | 10.00 KM | 0.10 KM | 9.90 KM | Under a minute |
| International, lowest cost | 100.00 USDC | 0.80 USDC | 91.26 EUR | 2–4 hours |
| International, fastest | 100.00 USDC | 1.75 USDC | 90.39 EUR | 5–15 minutes |
| International, lowest cost | 200.00 USDC | 1.20 USDC | 182.90 EUR | 2–4 hours |
| International, fastest | 200.00 USDC | 2.55 USDC | 181.65 EUR | 5–15 minutes |

The local example has one eligible route and wins both cost and speed. The international routes share schematic roles but have distinct cost/time assumptions. These numbers are centralized fixtures, not live quotes or supported payment coverage. Quotes expire after two minutes. The local minimum is 1 KM, international minimum 5 USDC, and maximum entered amount 10,000 source units. The 10.6-second international playback is separate from its delivery estimate.

## Presenting

Open Presenter mode on desktop, or the settings control at the bottom of the phone. Manual interaction is the default. Play guided demo selects Anna, calculates routes, opens Advanced, chooses Fastest, reviews, starts the adapter, expands the route and resolves the receipt. Manual interaction stops the guide. Pause freezes execution, and restarting cancels obsolete actions. The optional interruption applies to the next confirmed journey. Sound is off until explicitly enabled. Reduced motion follows the operating system and can also be selected in presenter controls.

## Validation

`npm run check` runs strict TypeScript and 24 tests (15 new demo tests plus 9 existing tests). The demo tests cover amount boundaries, rounding across thousands of amounts, ranking, quote invalidation/expiry, no-route recovery, duplicate confirmation, stale callbacks, ordered progression, pause/resume/cancel/failure, expansion throughout progress, snapshot recovery, exact connector gaps, receipt consistency and the guide using the same actions.

Browser inspection covers 360, 390, 430, 768 and 1440 CSS-pixel widths; short desktop layout; search, input errors, 100-to-200 recalculation, route selection, sheet dismissal and focus containment/return, refresh recovery, reference copying, interruption, manual override and complete guided playback. Screenshots and a recording are in the handover outputs.

`npx tsx ops/verify-demo.ts https://neylo.xyz <output.json>` verifies the deployed route and all its referenced static assets, unchanged homepage presence, private admin API access, enrollment readiness and source-level backend isolation without creating any accounts or changing real records.

Physical iPhone/Android keyboards, OS screen readers and native 200% browser zoom require device/manual validation; viewport and reduced-motion checks do not claim physical-device testing. There is no optional business payout reveal. Receipts are local to the browser, not synchronized to real accounts. Clearing this feature's storage loses its local history. No external execution can occur.

## Deploy

Use the existing `npm run build:production`, then deploy that exact artifact with `node node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.json`. Do not change DNS or production financial/acquisition data to deploy this feature.
