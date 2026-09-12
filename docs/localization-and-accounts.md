# Currency display and private registered accounts

Deployed 12 September 2026. Cloudflare Worker version `d5ea139f-2a3d-44f6-bc94-7f4878906c3b`.

The operator approved local equivalents of the existing 100 KM offer, rather than separate $100/€100 entitlements. Campaign version, ledger amounts, award transactions, and limits remain unchanged.

## Display currency

- The Worker overwrites `x-neylo-country` using Cloudflare's trusted `request.cf.country`. It does not trust a caller-supplied country header. Country data affects presentation only, never eligibility or awards.
- Unicode CLDR country/currency data maps 255 territories to 152 display currencies. The checked-in mapping was retrieved on 2026-09-12, with its Unicode license. Unknown territories fall back to BAM.
- First render uses the detected country or a manual `neylo_currency` preference cookie. The selector is available on signup and account pages. It retains the visitor's selection for one year and stores no account balance or authentication data.
- 100 KM displays as approximately €51.13 using the [CBBH peg](https://www.cbbh.ba/) of 1 EUR = 1.95583 KM. Other quotes use the [Frankfurter API](https://frankfurter.dev/) for today's date, with their actual quote date shown. Quotes must be positive, for the requested pair, no more than seven days old, and not future-dated.
- Successful quotes are cached per currency in each Worker instance for one hour; concurrent lookups share one request. Failed lookups are cached for one minute. Fetch has a 2.5-second timeout. No visitor IP, email, cookies or account records are sent to the rate provider. There is no new paid service or API key.
- Unavailable rates display the actual KM amount and an explanatory status. The EUR peg remains available without an external request. Conversion is approximate and cannot be spent, redeemed or used to change an award.
- Card, welcome/referral offer, account balance, credit breakdown and credit history share one display context. Accounts also show the actual reserved KM balance. Admin metrics and their CSV remain in BAM for consistent accounting.

## Registered emails

Open [Registered accounts](https://neylo.xyz/admin/accounts), or follow the new button from [Validation](https://neylo.xyz/admin/validation). Sign in as `kerim@horalix.com` using its emailed verification code; there is no password.

The table shows completed handles, verified Auth email, completion time in UTC, cohort and campaign source. Search is a case-insensitive literal substring, with optional leading @ for a handle. All accounts is the initial filter, with staff/test classifications visible. Participants excludes staff, tests and compensated research. Results paginate in deterministic completion-time/account-ID order, 25 per page, and refresh while visible.

Migration `202609120006_operator_accounts.sql` adds a service-only RPC. Both the application service and Postgres require a verified operator. Presenters cannot read the list. Incomplete attempts and unconfirmed Auth identities are excluded. The API is private/no-store and the page is noindex. Judge Mode and its CSV remain aggregate-only. No customer emails are embedded in client bundles or the public landing page.

## Verification for this update

- TypeScript and all nine unit tests pass. Currency tests include actual-value preservation, country mapping, reversals/zero, malformed rates, stale/future dates, timeout and provider failure.
- Seven Postgres checks pass using rollback fixtures: operator access, verified completion, deterministic pagination, email/handle search, cohort exclusion, role/RPC boundaries and page bounds. Existing local A/B records were preserved.
- The migration was applied to the managed production database and recorded in Supabase migration history.
- The production RPC's account count matched the authoritative completed-account metric (13 across all cohorts at 21:13 UTC). Ordinary users and anonymous RPC requests were denied.
- Production HTML and all 18 referenced CSS/JS assets returned 200. BAM, EUR, USD, GBP, RSD and JPY display endpoints returned valid dated quotes. The same connection's Cloudflare trace reported BA and automatic currency was BAM. A forged country header did not override detection.
- Anonymous accounts/metrics/export API requests returned 401; the private account page redirected to sign-in. HTTP and www still redirect to the canonical HTTPS apex. Enrollment remained open throughout this update.
- Actual browser checks: production euro/dollar card and offer, preference after refresh, handle typing while converted, 320/390-pixel signup screenshots, local desktop account table, production owner email search, and the existing local A account's 150 KM shown as approximately €76.69 with its 100/50 KM components.

Geographic mappings were exercised with supplied country metadata in the local server. Production detection was checked from the available BA connection; actual connections from every foreign country were not available. Physical mobile keyboards and foreign-country VPN sessions were not run for this update. The earlier full signup/referral/concurrency verification remains documented separately; no fresh customer OTPs or production reward mutations were needed for this display/read-only change.
