# Bosnia first. International by design.

Updated 24 September 2026. This is an engineering foundation, not a claim of worldwide payment availability.

## Implemented in this branch

- An owner declares **bank country and account currency independently**. A UK IBAN can be labeled USD if the owner confirms that their bank accepts USD; Neylo does not infer currency acceptance from an IBAN. Country defaults are suggestions only.
- 152 currency definitions provide exact minor-unit parsing/formatting, including USD/EUR/BAM (2), JPY (0) and KWD (3). No floating-point multiplication, automatic rounding or implicit conversion is used for payment amounts.
- 14 reviewed IBAN formats: Bosnia and Herzegovina, Austria, Switzerland, Czechia, Germany, Denmark, France, United Kingdom, Croatia, Netherlands, Norway, Poland, Sweden and Slovenia. Each has structure, country and mod-97 checks in both TypeScript and the database.
- @handle lookup returns the declared currency and bank country with masked account details. Preparation rechecks the saved revision; changing country/currency rotates that revision. The sender cannot quietly switch a recipient's currency.
- Country changes clear stale account details and amounts. Non-Bosnian IBANs are never stripped into an invented domestic account number. Additional intermediary/beneficiary requirements remain the sending bank's responsibility.
- The manual fallback offers country/currency selection. The labeled offline preview offers @nadin (BAM), @alex (EUR), and @maya (GBP).
- Future execution adapters use exact approved sender-residency, recipient-residency, bank-country and currency corridors. The approved list is empty. A currency in a menu can never authorize a transfer.

The current 1–100 units per plan is a conservative preparation limit, not equivalent buying power, a bank limit or a live risk policy. It must be replaced by provider/corridor-specific approved limits before execution. Existing reward-credit display conversions remain separate from payment amounts and never become payment quotes.

## What this does not enable

Worldwide registration eligibility, balances, card funding, FX, international remittances and payouts are **not** activated. Existing enrollment/legal eligibility rules remain intact. Bank-account collection is still disabled until migrations, privacy review and staged authenticated tests are complete. No bank has certified account ownership or currency acceptance.

The currency catalog is not a country coverage list. US routing/account numbers, Canadian transit numbers, Australian BSB and Indian IFSC are not IBANs. The UI explicitly reports other account formats as unavailable instead of squeezing them into a false IBAN. Other IBAN countries also remain unavailable until their formats are added and tested. One receiving destination per user is supported for now.

## Rollout that preserves a global product

| Stage | Deliverable | Exit criterion / dependency |
| --- | --- | --- |
| Now: global data foundation | Country/currency-aware username instructions; deterministic money; protected destination storage | 67 automated tests and 18 browser checks; staged Supabase two-user flow and advisors still required before storage rollout |
| Bosnia pilot | One reliable BAM execution corridor, verified recipient onboarding, clear fees/status and support | Signed partner scope; legal approval; end-to-end usable recipient funds; daily reconciliation; no unexplained ledger differences; explicit live activation approval |
| First international corridor | Pick one evidenced diaspora corridor, rather than launch everywhere at once | Confirm sender and recipient residency eligibility, entity requirements, funding and payout independently; signed FX quote with fee breakdown/expiry; refund and chargeback ownership; positive modeled unit economics |
| Regional expansion | Add country-specific account schemas and multiple saved receiving routes | Reviewed local validation and payout contracts; recipient selects supported currencies; server selects only approved routes; migration/backward compatibility tests |
| Wider global app | Local methods, languages, accessibility, fraud controls and support appropriate to each market | Local regulatory/partner approval and tested payout coverage per market; scoped operational ownership, recovery and support service levels |

Product goals for the pilot: returning users select a known person without typing account numbers; show all known fees before authorization; never show success before provider evidence of recipient availability; maintain WCAG AA checks and reduced-motion support. Measure completion time, error rate, repeat use, support contacts and successful usable-funds delivery. These goals are targets, not measured claims today.

Do not promise every country to every resident. Availability is evaluated from the actual customer, entity, provider and corridor. Language preference, residence, bank country, display currency and settlement currency must remain distinct. The adapter contract now distinguishes the corridor; residency verification/onboarding and an enforceable commercial capability registry are future work, not implemented compliance.

## Database rollout

Apply the existing receiving-accounts migration, then `20260923230511_international_receiving_accounts.sql` in staging. It adds country/currency defaults to existing BAM destinations, protected reference tables and a service-only IBAN validator, then replaces the receiving RPC while preserving consent/revision/audit behavior. Reference tables have RLS and no anonymous or authenticated-client grants. Server service-role access remains required.

Regenerate database types from staging, run Supabase advisors, and verify two real authenticated users: save a GBP destination; find by handle; prepare matching GBP instructions; change currency; reject the old revision; opt out; ensure lookup stops. Verify existing BAM destinations are preserved. Keep `RECEIVING_ACCOUNTS_ENABLED=false` until this passes and the privacy notice is approved. No migration or production deployment was performed in this delivery. The local Supabase advisor attempt could not connect because local Supabase was not running; actual SQL was tested in isolated PGlite, not a hosted Supabase instance.

## Sources and maintenance

- [SWIFT IBAN Registry](https://www.swift.com/swift-resource/9606/download?language=en), Release 103, September 2026: reviewed country structures and illustrative fixtures in `bank-formats.json`. Format validation does not verify ownership, domestic check digits, bank identifiers or live network access.
- [SIX ISO 4217 currency list](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml), published 17 September 2026: currency names and minor digits in `currencies.json`, intersected with the repository's existing CLDR country-currency catalog to exclude unrelated fund/metals codes. This is a curated 152-code catalog, not every ISO code or a promise of bank acceptance.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): exposed tables remain protected, client roles have no destination/reference-table grants.

When refreshing either catalog, review the source changes, add a forward migration for the SQL reference tables, and run the TypeScript/SQL parity tests. Never reinterpret amounts already recorded in a plan or ledger under a new currency exponent. Current instruction plans snapshot the currency; a future durable ledger must also snapshot the applicable currency definition/version and quote.
