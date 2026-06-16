## Plan

1. **Stop the legal popup/check loop**
   - Fix `TermsReacceptanceGate` so the required-doc list is stable instead of being recreated every render.
   - Add an in-flight/cancel guard so the dashboard cannot fire dozens of `terms_acceptances` reads at once.
   - Keep the compliance gate behavior intact: if terms are truly outdated, it still blocks until accepted; if current, it stays invisible.

2. **Make cookie preferences non-disruptive on dashboard/mobile**
   - Keep cookie/legal compliance, but change the dashboard/mobile presentation so it does not cover the bottom navigation, booking UI, or dashboard cards.
   - On authenticated dashboard routes, show a smaller mobile-safe preferences strip/sheet positioned above the mobile nav with stable dimensions.
   - Ensure “Reject all” and “Accept all” immediately persist the choice so it does not keep reappearing after the user taps it.
   - Keep the full “Customize” dialog available, but make it mobile-safe and prevent it from causing page width/scroll jumps.

3. **Reduce mobile shifting/flicker**
   - Remove/limit the global transition rule that animates all color/background/border changes across the entire app, because it can make first-load dashboard paints look flashy.
   - Add hard `overflow-x: hidden` at the root/body level and use safe viewport sizing for fixed mobile overlays.
   - Keep dashboard content from moving side-to-side even when banners/dialogs mount or unmount.

4. **Verify the fix**
   - Re-test `/dashboard` at a Chrome mobile viewport with no saved cookie preference.
   - Confirm: no horizontal overflow, cookie prompt does not cover mobile nav/booking actions, legal terms check runs once, and no popup loop occurs.

## Technical notes

- The screenshot shows `CookieConsentBanner` mounted as `fixed bottom-0 inset-x-0 z-50`, the same layer as mobile navigation, so it can sit directly over operational controls.
- Browser network logs show many repeated reads to `terms_acceptances`; the likely cause is `requiredDocsForJurisdiction(...)` returning a new array each render, which retriggers the legal gate effect.
- This is a contained frontend/compliance-flow fix; no database schema change is needed.