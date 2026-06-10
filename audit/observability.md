# Exotiq Observability Audit — Static Review

Scope: error handling, silent failures (esp. payment flows), error tracking.
Method: 100% static (no DB / no runtime). Confidence stated per finding.
Date: 2026-06-10.

Severity legend: Critical / High / Medium / Low.

---

## 1. Error tracking / telemetry

### 1.1 No error-tracking backend exists — **HIGH** (confidence: high)
Grep for `sentry`/`@sentry`/`datadog`/`logrocket`/`bugsnag`/`posthog` across `src/` and `package.json` → **zero results**. There is no crash/error reporting, no APM, no breadcrumbs. In production, all client-side and (largely) edge-side failures are invisible unless someone tails Supabase function logs live.
Impact: The payment, auth, and Rari issues in this audit would fail silently in prod with no alert. There is no way to know a Stripe-mid-flow inconsistency (see §3) ever happened.
Fix: Add Sentry (or equivalent) to both the React app and the edge functions; wire it into the logger below.

### 1.2 `src/lib/logger.ts` discards ALL logs in production — **HIGH** (confidence: high)
File: `src/lib/logger.ts`. Every helper (`devLog`, `devWarn`, `devError`, `devGroup`, `devTable`) is guarded by `if (import.meta.env.DEV)`. In a production build `import.meta.env.DEV === false`, so **`devError(...)` is a complete no-op** — errors routed through it vanish with no console output and no remote capture.
Impact: Any code path that "handles" an error by calling `devError`/`devLog` is a silent-failure path in prod. It is named like a logger but is a dev-only console shim.
Fix: Route `devError` (and a new `logError`) to the error-tracking backend (§1.1) in production instead of dropping it. Keep verbose `devLog` dev-only, but errors must always be captured.
Note: `devError`/`devLog`/`devWarn` are used in ~12 files; `console.error` directly in ~109 files. So most code still logs to console directly (visible in browser dev tools / function logs), but anything funneled through the logger module is silently dropped in prod.

---

## 2. Swallowed / ignored errors

### 2.1 Supabase calls that drop the `error` return — **MEDIUM** (confidence: high)
23 sites in `src/` destructure only `const { data } = await supabase…`, discarding `error`. On failure these silently produce `data = null` and the UI degrades with no signal. Representative examples:
- `src/hooks/useBillingDunning.ts:56` — billing/dunning state read; a dropped error here means a user could be shown wrong billing/past-due status.
- `src/components/super-admin/MaintenanceModeSection.tsx:105` — super-admin maintenance toggle read.
- `src/hooks/useTeamMessaging.ts:83`, `src/hooks/useTeamGasFeeSettings.ts:35`, `src/components/fleet/FleetPageEnhanced.tsx:83`, `src/components/dashboard/Core.tsx:35`, `src/components/photos/usePhotoAnalysis.ts:383`, `src/components/dashboard/settings/{IntegrationsSection.tsx:67,MyAccountSection.tsx:58}`, `src/components/onboarding/{InteractiveModuleTour.tsx:154,DashboardOnboarding.tsx:149}`, `src/hooks/useTourNavigation.ts:55`.
Impact: silent data-load failures, hardest in the billing path.
Fix: Always destructure and handle `error`; surface a toast and report to Sentry.

### 2.2 No fully-empty `catch {}` blocks in `src/` — GOOD (confidence: high)
Grep for `catch (…) {}` → none. Catches generally do *something* (toast or console). The risk is what that "something" is (§1.2 no-op logger, §3 below), not empty blocks.

---

## 3. Silent failure paths in payment flows

### 3.1 `stripe-create-hold`: card hold authorized, then DB insert NOT checked — **HIGH** (confidence: high)
File: `supabase/functions/stripe-create-hold/index.ts:117-139`.
Sequence: Stripe `paymentIntents.create` authorizes a real **hold on the customer's card** (`:109`), then `await supabaseClient.from("payments").insert({…})` (`:117`) records it — but the insert's `error` is **never captured or checked**. The function then returns **200** with the `payment_intent_id` regardless of whether the DB row was written.
Failure mode: If the insert fails (constraint, transient DB error, RLS/role drift), Stripe holds money on the customer's card but **no `payments` row exists**. The app has no record to later release or capture that hold → an **orphaned authorization** sitting on the customer's card until it expires (and the code sets a 7-day expectation). No log captures the failure (the only logging is the success `logStep`). This is a money-correctness + customer-trust issue with zero observability.
Fix: Check the insert error; on failure, either cancel the just-created PaymentIntent (compensating action) or persist to a durable retry/reconciliation queue, and alert.

### 3.2 `stripe-capture-hold` / `stripe-release-hold`: DB `update` result not checked — **MEDIUM** (confidence: high)
File: `supabase/functions/stripe-capture-hold/index.ts:74-78` (and the release sibling). After Stripe captures, `payments.update({ hold_status: 'captured', … })` runs without error checking; the function returns success on the Stripe result alone. Lower severity than 3.1 because Stripe is source-of-truth and `stripe-webhook` independently reconciles `hold_status` on `charge.captured`/`payment_intent.succeeded`. Still, a failed update leaves the local row stale until/unless the webhook lands.
Fix: Check the update error and log/alert; rely on the webhook as backstop but don't ignore the primary write.

### 3.3 `stripe-webhook`: every insert/update is fire-and-forget — **MEDIUM** (confidence: high)
File: `supabase/functions/stripe-webhook/index.ts` — `payments.insert` (`:139`), `bookings.update` (`:158`), `payments.update` (multiple), `payouts.insert` (`:274`), `notifications.insert` (`:114,245,303,329,356`), and the event-record insert (`:48`) are all `await`ed but their `error` returns are **not checked**. The handler returns `200 { received: true }` as long as no exception throws. A Supabase write that returns an error object (rather than throwing) is silently lost, and because the event is already marked processed in `stripe_webhook_events` (`:48`), Stripe won't retry it → permanent divergence between Stripe and the DB (e.g. a `checkout.session.completed` whose `payments` insert failed records the event but never the payment).
Impact: Silent revenue/booking-state drift with no alert. The processing-fee logger (`logStripeProcessingFee`) is the only place that inspects an error, and it only `console.error`s.
Fix: Check each write's `error`; if a write fails, do **not** 200 (let Stripe retry) or push to a reconciliation queue; emit to error tracking.

### 3.4 Frontend payment components handle errors correctly — GOOD (confidence: high)
`src/components/dashboard/PaymentTracker.tsx:120-158` (capture/release/refund) consistently does `if (error) throw error;` then `toast.error(...)` in `catch`. `RecordPaymentDialog`, `PaymentDueGuard`, `PaymentDueBanner` similarly surface failures via toast. The weakness is server-side durability (§3.1–3.3) and the fact that these toasts are not also reported to a backend (§1.1), so a spike in payment failures is invisible to operators.

---

## 4. Cross-cutting

### 4.1 Logging leaks request context but not to a durable sink — **LOW** (confidence: high)
Edge functions log richly via `console.log`/`logStep` (e.g. `elevenlabs-tools` logs headers with auth redacted — good). But these only live in Supabase function logs (short retention, no alerting). Without §1.1 there is no aggregation, search, or alert over them.

### 4.2 `demo-login` swallows the real auth error from the user — **LOW** (confidence: medium)
`supabase/functions/demo-login/index.ts:89-95` logs the real error server-side but returns a generic "Demo mode temporarily unavailable" — acceptable for security, noted for completeness.

---

## Top 5 by severity

1. **HIGH — No error tracking anywhere** (`package.json`/`src/` have no Sentry/Datadog/etc.). Production failures, including payment inconsistencies, are invisible.
2. **HIGH — `logger.ts` is a no-op in production** (`src/lib/logger.ts`). `devError` drops errors entirely in prod builds; anything funneled through it is a silent-failure path.
3. **HIGH — `stripe-create-hold` orphaned-authorization path** (`stripe-create-hold/index.ts:117`). Card hold succeeds, `payments` insert error is unchecked, function returns 200 → real money held with no DB record to release/capture, no log.
4. **MEDIUM — `stripe-webhook` fire-and-forget writes** (`stripe-webhook/index.ts:48,139,158,274,114…`). Event marked processed even if the DB write silently fails → permanent Stripe↔DB drift, Stripe won't retry, no alert.
5. **MEDIUM — 23 frontend Supabase calls discard `error`** (e.g. `useBillingDunning.ts:56`, `MaintenanceModeSection.tsx:105`). Silent data-load failures, most consequential in the billing/dunning path.
