# Connected NEYLO experience

The presentation now has two participant routes, `/demo/nadin` and `/demo/kerim`,
in addition to the existing `/app/demo` routing experience. These pages use
presentation identities and example email addresses; they do not sign into or
impersonate actual registered participants.

Open either route and choose **Connect the two pages** (or start sending). The
pairing sheet provides a QR, an Open link and Copy pairing link. Open that link
on the second device. A 192-bit room capability lives in the URL fragment and
the namespaced `neylo:demo:pair:v1` browser storage key. A bare participant URL
reuses the most recently paired session in that browser. Different devices must
use the pairing link; globally guessing a participant's handle is not pairing.

Both participants can send to the other. The composer uses the existing integer
minor-unit quote engine. A 25 KM total includes a 0.10 KM fee and yields 24.90 KM
for the recipient. A new transfer has one UUID and a durable idempotency key.
Concurrent confirmations, retries after arrival and browser refreshes preserve
that record. One transfer can run in a session at a time. The activity list,
sent/received totals and receipts derive from the shared records.

Final financial execution remains simulated. This must be verbally disclosed
during the presentation. No bank API, real balance, payment execution, bank
confirmation, acquisition event or promotional entitlement is involved. The UI
uses neutral journey/arrival language and does not claim a provider confirmed
execution. The 15-second duration is presentation execution, not measured bank
settlement or a promise about production payment speed.

## Isolation and synchronization

`src/features/demo/shared/domain.ts` defines participants, validation, quotes,
room transitions and transfer projection. `room-worker.ts` exports the
`DemoRoom` Cloudflare Durable Object and the `/api/demo-room` handler. Requests
are handled before the normal framework API; this module has no Supabase import.
The new SQLite-backed namespace is separate from acquisition Postgres and uses
the existing Cloudflare deployment. No DNS or authentication change is required.

The object stores the session and schedules an alarm for the 15-second arrival.
Reads also reconcile elapsed deadlines. Only server state can mark completion;
client interpolation stops short of the completion event until confirmation
arrives from the room. Closing both pages does not cancel the server deadline.
Repeated alarms and requests do not append duplicate receipts.

`use-room.ts` reads canonical snapshots through SWR, polling every second during
a transfer and every five seconds while idle. Polling stops in hidden pages and
after expiry; returning to the page revalidates. No cookies or real account
credentials are required for a room. Possession of a pairing link grants both
presentation roles within that room, so share it only with the participants.

Sessions expire after 24 hours; Durable Object alarms delete the session storage.
Each session permits 40 transfers, and creation is limited to 24 sessions per IP
per hour. The limiter stores a hash, not the original IP. A new paired session
creates a fresh room instead of deleting another participant's active session.
The old room remains available until expiry. No unrelated local storage is cleared.

## Interaction and motion

`shared-app.tsx` and `shared.css` provide the same working phone UI on desktop and
the full viewport on mobile, including safe areas, focused decimal entry,
profile/pairing sheets, activity and reciprocal sends. The original demo has a
new connected-experience entry, less repetition in tracking/receipts, smoother
scroll targeting and animated sheet dismissal.

The reused `RouteJourney` keeps node and connector identities stable. Connector
geometry follows animated DOM positions through SVG attribute updates without
rerendering the React tree every animation frame. Both layouts retain the 8px
circle-to-connector gap. Stroke progression, state colors and completion marks
use restrained transitions; the existing reduced-motion policies apply.

## Verification commands

```
npm run check
npm run build:production
node node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --port 3102 --var APP_STAGE:development
node node_modules/tsx/dist/cli.mjs ops/verify-shared-demo.ts
node node_modules/tsx/dist/cli.mjs ops/verify-shared-demo.ts https://neylo.xyz
```

Use the last command only after deployment. It creates two isolated presentation
rooms, tests origin/input boundaries and concurrent requests, disconnects for
the arrival window, then compares two independent clients and the isolated room.
It does not request email, authenticate a real account or touch campaign data.

Cloudflare references: [SQLite on the Free plan](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[durable alarms and binding configuration](https://developers.cloudflare.com/durable-objects/examples/alarms-api/).
