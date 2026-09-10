# First-run experience — revised

## What I found walking the flow

The current first run is three disconnected things:

1. **Signup setup** (`/onboarding`) — business profile, then fleet size and locations, then add a vehicle or import. It stops there. Tax rates, pickup-location details and getting paid never come up.
2. **A narrated auto-tour** on the dashboard, offered as the main thing to do next ("Take the tour" / "Skip, I'll set up myself").
3. **A checklist** that only appears if you skip the tour, plus the readiness card I added last week.

So a new customer's very first decision is "watch a tour or not", and the checklist — the thing that actually gets them ready to take money — is hidden behind skipping it. The step that finally lands them on the dashboard is the same step that leaves them least prepared.

## My pushback: keep the walkthrough, but stop making it the front door

Every teardown of the products people copy here says the same thing: the tour is not what activates anyone. What activates is getting the account to its first real outcome and deleting everything between signup and that moment [2](https://www.themasterly.com/blog/saas-onboarding-ux-guide). Reviewing fifty flows, the winning pattern was never the welcome modal, the checklist or the tour on its own — it was matching the first session to the job the customer signed up to do [1](https://userorbit.com/blog/patterns-from-50-saas-onboarding-flows). And the standard rule for wizards: only put in the wizard what the product genuinely cannot work without, everything else belongs on a checklist [4](https://kompassify.com/blog/onboarding-wizard-guide).

So I would **not** delete the walkthrough — it is good, and Rari narrating is a real differentiator. I would demote it:

- The dashboard's first prompt becomes **"You're 4 steps from taking your first booking"**, not "Take the tour."
- The walkthrough moves to a quiet secondary offer, and the 80-second overview video we just produced becomes the default way to "see how it works" — most people would rather watch 80 seconds than click through fourteen spotlights.
- The live walkthrough stays available on demand from the help menu, with its chapter list visible.

If you'd rather keep the tour front and centre, say so and I'll flip it back — but I think the readiness score deserves that slot.

## The new shape

**Signup asks for the minimum, then gets out of the way.** Three steps, each with Back, Skip and "Step 2 of 3":

1. **Your business** — name, contact, address, country (drives currency and tax defaults), logo.
2. **Where you hand over cars** — first pickup location with its tax rate, tax label and whether prices include tax, defaulted from the address.
3. **Your fleet** — import a spreadsheet, add one manually, or skip.

Payments moves out of signup and onto the readiness list, because connecting a payout account is a five-minute detour with an external site and nobody should hit it before they've seen the product.

**The dashboard carries the rest.** One readiness panel, honest and clickable:

```text
Ready to take bookings        4 / 6   ██████░░░
Ready for Drive Exotiq        6 / 9   █████░░░░
```

Each unfinished line jumps straight to the field that fills it — business address, logo, contact email, terms, a pickup location, tax rate, payments enabled, payouts enabled, a vehicle with photos and a rate. Completed lines collapse. The panel disappears entirely once both rows are full, and the separate getting-started checklist is retired into it so there is only ever one list.

**Everything skippable, nothing lost.** Skipping any step files it on the readiness list rather than dropping it. Progress saves as you go, so signing back in resumes exactly where you left off.

## Technical notes

- `/onboarding` keeps `useOnboardingProgress` (`current_step`, `steps_completed`, `form_data`); the debounced save and resume already work. Step 2 gains the location tax fields and step 4 (import) folds into step 3.
- Location tax writes go through the same path as `EditLocationDialog` (`tax_rate_percent`, `tax_label`, `tax_inclusive`), with defaults from `src/lib/countryDefaults.ts` and resolution via `src/lib/taxResolution.ts` — unchanged behaviour for existing tenants, whose values stay null.
- The readiness panel replaces `GettingStartedChecklist` and extends `BookingReadinessCard`, reading `get_marketplace_readiness` plus a location/tax check. No new readiness rules, just a customer-facing view with deep links.
- `DashboardOverviewEnhanced` swaps the tour prompt for the readiness panel; the tour launcher moves to the help menu and keeps its existing `start-demo-tour` event, chapter list and skip/back handling.
- The overview video is served from the help menu and the empty-dashboard state.
- All of it behind the existing feature flag until switched on.

## Sequencing

1. Readiness panel and retire the duplicate checklist — helps all 17 existing tenants immediately.
2. Rework signup into the three steps with tax on the location step.
3. Demote the walkthrough, add the video entry point, help-menu replay.
