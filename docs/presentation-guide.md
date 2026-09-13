# Presenting NEYLO

Open [neylo.xyz/pitch](https://neylo.xyz/pitch). The default **Projector** palette
uses a light sapphire canvas, dark text and strong blue emphasis. The same
control switches to Sapphire. Use the fullscreen button, arrow keys, chapter
rail or bottom controls. Manual interaction pauses the three-minute guided pitch.
Speaker notes include a downloadable script and primary-source links.

Use the [three-minute spoken script](hackathon-script.txt) for rehearsal. It opens
with someone the audience could message, follows the eleven existing chapters,
and includes unspoken stage cues and a connection-delay fallback. Its 361 spoken
words leave room for pauses and the two-device arrival. Rehearse aloud with the
devices; the chapter timings are targets, not a measured speaking duration.

## The story

1. You know who; the software finds the way.
2. The everyday pain of collecting bank details, comparing costs and tracking arrival.
3. The opening created by Bosnia and Herzegovina's payment modernization.
4. A human-readable identity above the institutions and routes.
5. Working quote calculation, with cost and speed trade-offs.
6. A two-device send and arrival that the audience can try.
7. The actual waitlist signal, with verification provenance visible.
8. A focused local use case and Bosnia–euro area pilot.
9. Explicit business assumptions, with an interactive fee model.
10. One-, five- and ten-year ambitions, each with operating gates.
11. The ask: a pilot integration partner, a first cohort and operating expertise.

The milestones link to CBBH's IPS launch announcement (20 July 2026), financial-law
adoption announcement (28 July), and SEPA application (6 August). The PSD2 source
is the parliamentary payment-services reform text. A SEPA application is not
membership. None of these milestones establishes NEYLO bank or rail access.

## Two-device sequence

Before the demonstration, say: **“Financial execution is simulated for this
hackathon. The routing, shared application state and receipts are working software.”**

Open `https://neylo.xyz/demo/nadin` and `https://neylo.xyz/demo/kerim`. The bare
URLs share a public presentation room. On Nadin, tap Kerim, enter `25`, then
send. Kerim sees the incoming journey and a 24.90 KM receipt, with 0.10 KM fee
included in the 25 KM total. The canonical arrival event occurs after 15 seconds;
network polling adds a small display delay. This duration is presentation playback,
not measured bank settlement. Both participants can expand the route, refresh,
review activity and send back.

For an isolated rehearsal, create a private session under Connection settings
and open its QR/link on the other device. Both bare URLs are intentionally public,
so another visitor may also interact with the shared stage. Refresh both pages at
the start of a new day's presentation. No activity reaches the acquisition database.

## Routing workbench

At `/app/demo`, select Anna and compare 100 and 200 USDC under Lowest cost and
Fastest. Advanced opens over the same composer. Confirm starts the ordered
simulation adapter; Pause and refresh preserve progress. Presenter controls provide
guided playback, restart, speed, sound opt-in, reduced motion and a failure scenario.

## Boundaries

Live waitlist metrics come from the existing read-only Postgres projection every
30 seconds. Imported accounts remain separately labeled; registrations are not
active users, payment volume or revenue. Historical credits are preserved and
new rewards remain closed. No real accounts, bank integrations, authentication,
campaign logic, DNS or acquisition records are changed by this presentation.
