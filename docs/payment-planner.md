# A useful first payment journey

**Update:** `/pay` now defaults to usernames. This document describes the manual-entry fallback. See [username payments](username-payments.md) for saved receiving accounts, privacy, schema and rollout requirements.

**23 September 2026 · `/pay` · bank instructions, not integrated execution**

## What you can do

1. Enter a recipient's full name and Bosnian IBAN supplied through a trusted channel.
2. Choose 1–100 BAM and an optional payment purpose.
3. Review the exact details and acknowledge that account ownership is not verified by Neylo.
4. Copy the fields or download a clearly labeled payment plan.
5. Make and authorize the payment separately in your existing bank app.
6. Optionally mark the plan as sent **by you**. This never becomes bank confirmation. Undoing that status cannot cancel a bank payment.

No bank integration, credentials, card details or customer-funds account is needed to use this planner. Neylo does not receive, hold, authorize or move money. The bank determines fees, required fields, route and arrival time. The UI does not promise that the recipient receives the full entered amount free of bank fees.

## Product design

The desktop interface pairs a four-step form with a persistent payment summary. On mobile, the redundant summary is removed so the task stays readable. The design uses the existing sapphire visual identity, clear spacing, strong amount typography, labeled controls and comfortable touch targets.

Transitions use a 200 ms fade with at most 10 px of movement. Reduced-motion users get no spatial transition. There are no simulated transfer progress bars, fake arrival animations, forced waits or success confetti. Focus moves to the new step heading; validation messages receive keyboard focus. Copy feedback is announced without replacing the user's payment details.

Clearing a draft requires confirmation. Refreshing discards it; the page warns on browser unload where supported. Navigation may discard it without a prompt, while browser back/forward caching can preserve a page's memory. Use Clear & start again when finished on a shared device. Download is explicit and includes recipient data: keep exported files private.

## Privacy boundary

The planner keeps its entries in React memory only. It does not put names, IBANs, amounts or purposes into URLs, cookies, localStorage, sessionStorage, the account database or API requests. Copy and download are explicit user actions. This is not encryption against someone who controls the device, browser extensions, clipboard history or downloaded files. The surrounding application's normal page requests and account session behavior still exist.

There is no saved-recipient directory yet. Reserved @handles remain account identities, **not verified payment destinations**. Checking an IBAN checksum cannot establish account existence, ownership or receiving capabilities. The BA20-character format and checksum are based on [CBBH's published IBAN instruction](https://cbbh.ba/Content/Read/609?lang=bs); the public example account is used only in tests, never prefilled into the product.

## Where the implementation lives

| File | Responsibility |
|---|---|
| `src/app/pay/page.tsx` | Route and accurate metadata |
| `src/features/payments/payment-workspace.tsx` | Four-step interactive flow |
| `src/features/payments/payments.css` | Responsive interface and motion rules |
| `src/features/payments/domain.ts` | Exact amount parsing, IBAN validation, immutable input snapshot, clear exports |
| `src/features/payments/provider.ts` | Future adapter types and disabled capabilities; no provider implementation |
| `src/app/api/payments/capabilities/route.ts` | Versioned read-only availability response |
| `tests/unit/payment-planner.test.ts` | Amount, account, injection, reporting and capability safety checks |
| `tests/browser/payment-planner.spec.ts` | Real-browser journey, download, privacy, editing, navigation, accessibility and viewport checks |

Existing account/authentication logic, promotional-credit records and simulation tools are retained. No database migrations or production settings were changed. The planner is independent of the local contract simulator.

## Try it locally

Use Node 24 (matching CI), then:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3100/pay`. The planner works without Supabase configuration. Existing authenticated features still require their normal configuration. Never send money to a test fixture account.

```sh
npm run check
npx playwright install chromium
npm run test:browser
npm run build
```

Browser tests run on desktop Chromium and mobile-sized Chromium with reduced motion. They use a development server and test data only. Screenshots/traces are in ignored `test-results/`. CI installs Chromium and reruns the tests on every push/PR. These are not physical-device, Safari, bank-integration or live-money tests.

## What remains before a real integrated payment pilot

An approved complete funding/payout program, verified recipient enrollment, server-side customer authorization, durable payment orders, partner-specific signed callback verification, statement reconciliation, risk/complaint operations, legal review and explicit live activation. The types and simulator help organize this work; they do not provide any of those permissions.

Read [the partner integration guide](payment-integration-guide.md) for the implementation gates. Do not deploy the old presentation demos as evidence that real money moved.
