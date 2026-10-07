# Controlled rollout and rollback

New external quote/request writes begin disabled globally and per operator. Missing/unavailable flag authority denies new writes. Catalog visibility requires explicit operator opt-in and ordinary public eligibility. Existing owned request status, recovery, identity, checkout, payment/webhook reconciliation and notification work retain continuity when new writes are disabled or an accepted operator opts out. Flags do not cancel bookings, clear holds or reverse historical charges.

A verified current Supabase actor must have an active direct source-admin UUID and an independently reviewed private external_rollout_admins binding to change the global switch or retention. The private binding has no public/service write privileges and is seeded only through a reviewed database-admin procedure; there is no automatic email backfill. Operator opt-in requires current verified identity and active owner/admin membership (owner also matches teams.owner_id). Applied source admin/membership integrity is independently reviewed before release.

After staging gates pass, a reviewed administrator disables new writes with `SELECT public.external_set_global_new_writes(false);` under that authenticated verified actor. An operator can disable its own new catalog/writes using `SELECT public.external_set_operator_api_enabled(<owned_operator_uuid>,false);`. These calls audit before/after values atomically. Execute them only in the explicitly selected environment; this document authorizes no production mutation. Never drop additive schema, reset grants, refund/cancel all bookings, stop financial workers, or delete historical rows as rollback.

Before enabling:100% quote/request/both-charge itemization equality; zero unauthorized actions, duplicate bookings, overlaps, false confirmations or leaks; both clients in Miami/Tampa and all adverse journeys pass; revocation on the next request; scheduler lag≤5minutes. Investigate every low-volume UNKNOWN/handoff failure. Alert when UNKNOWN or handoff failure exceeds1% over15minutes with100 samples; authority outage blocks new writes immediately. Upcoming markets remain disabled until separately accepted.

The external-booking-worker requires CRON_TRIGGER_TOKEN, INTERNAL_FUNCTION_TOKEN, fixed SUPABASE_URL/service key, RENTER_APP_ORIGIN and EXTERNAL_NOTIFICATION_PROVIDER_PROFILE=resend-idempotency-24h-v1. These secrets belong only in reviewed server runtime configuration. Configure a dedicated cron invocation of the worker and preserve scheduler isolation; source entry existence does not prove a deployed schedule. Without a reviewed provider dedupe profile it must refuse before claiming notification work.

Notification outbox delivery uses one stable key, a2-minute live fenced lease, small bounded batches and provider message receipt. Missing/ambiguous responses retry within23hours and then require manual review; no exactly-once SMTP guarantee. Payment charge/refund attempts similarly preserve keys and provider windows. Optional redacted telemetry sink requires fixed allowed HTTPS host, token and event-id-dedupe-v1; absent sink leaves events durable for bounded retention. event_retention_days defaults30 and is adjustable1–90 by reviewed admin. Delivered/manual notification private context is scrubbed after retention. Inspect notification lag and manual-review counts through the narrow maintenance RPC.

Full hosted OAuth/Stripe/identity/complete-schema parity and safe deployment/rollback drills remain release gates. Local isolated evidence cannot replace them.

The source persistent limiter previously admitted requests indefinitely at capacity. The additive `20261007090720_persistent_rate_limit_capacity.sql` repair reserves each slot atomically, denies further calls, retains the server-only signature and bounds lock/statement waits. Include it in reviewed applied-schema and concurrency acceptance; API signature checks alone cannot compensate for an incorrectly implemented budget.

See [pilot evidence](pilot-evidence.md) for the distinction between local composition and hosted release acceptance.

The additive `20261007090730_preserve_unresolved_checkout_inventory.sql`
preserves inventory for an issued or ambiguous checkout reservation even before
a payment intent or webhook is recorded. Reservation metadata cannot be cleared
to bypass cancellation guards. The existing payment scheduler queues these
rows in a bounded oldest-first, SKIP LOCKED manual-review batch before expiry;
a failed queue call refuses the expiry sweep. A real two-connection settlement
vs expiry test retains the hold. This is a deliberate safe fallback: automatic
provider-authoritative Checkout expiry/retrieval and a clearance RPC are not
implemented. Uncertain holds can persist until reviewed reconciliation. Never
clear a hold based only on elapsed time, missing webhook, absent reference or
network failure. Before rollout, audit/drain/reconcile legacy sessions created
before reservation tracking and establish the authorized provider reconciliation
procedure. That operating gate is required before exposure.
