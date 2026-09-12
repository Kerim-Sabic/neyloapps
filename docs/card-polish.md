# Sapphire card depth and motion

Deployed 12 September 2026. Worker version: `68544b44-25fe-4ef8-bc85-a7ed56122550`.

The real identity-card component now has a layered edge, a clipped sapphire material surface, raised type, directional lighting and a soft shadow. Its unclipped outer shell preserves CSS 3D depth. The proportions, live handle and authoritative credit display are retained.

A ten-second gentle drift and twelve-second light sweep add restrained ambient movement. Fine mouse pointers add a spring-driven tilt capped at 3.5 degrees vertically and 5 degrees horizontally. Touch does not tilt the card. Pause/resume is available from a labeled button below the card.

Motion pauses while the card is offscreen, the document is hidden, signup is held for verification, or its QR sheet is open. Native focus within the signup form pauses CSS animation immediately, including focus acquired before hydration. Reduced-motion styles disable animation and flatten the decorative transforms; the existing reduced-motion hook also disables pointer tilt.

During browser review, different browser/server ICU currency names caused a hydration mismatch. Currency labels now use one checked-in dictionary so both render the same text.

Verified:

- TypeScript and all nine existing unit tests passed.
- Actual desktop and 320-pixel mobile renders were inspected; no horizontal overflow.
- Pointer dragging across the surface produced a real 3D matrix transform.
- Pause control stopped both drift and sheen. Signup focus produced identical transforms across observations while the handle remained editable.
- The existing local account retained its real 150 KM entitlement. Its QR dialog was open with no transform and the card animation paused; Escape closed it.
- Fresh browser console had no errors after the currency-name fix.
- Production HTML and all 19 referenced CSS/JS assets returned 200, including the new card stylesheet. Enrollment remained open. Anonymous admin-account requests still returned 401.
- The production animation was captured as 32 actual browser frames with capture timestamps. The GIF is a sampled recording, not a measurement of browser frame rate.

No database migration or promotional award changes were needed. OS-level reduced-motion switching and physical-device touch were not available in this browser tool; those branches were reviewed in source. No new production verification emails were sent for this visual update.
