# Source-evidenced booking capability inventory

Source base: backend `442dd4d1cb00823132d0a0f24a26892a70dd5288`, frontend `a2260c3de1b539d0a59ab5fa4d21e12f341cb92d`; copied into isolated worktrees on 2026-10-07. Source history and staged/deployed facts are distinct. No current production schema, roles, scheduler or function parity has been inspected.

The complete machine-readable inventory is `source-audit.json`: each writer candidate, overload/default/security-definer definition, chronological drop, privilege statement, trigger, RLS policy, RPC caller and lifecycle state has file/line/content hash provenance. `audit-source.mjs --check` plus the contract suite detects omitted records or stale hashes even without a changed HEAD. Final function identities are static migration-order reconstruction, not a database introspection result. Dynamic table/function constructs and unsupported body forms are explicit unresolved review candidates.

## Capability and gap summary

| Capability | Source authority | Present source behavior | Required gate/improvement |
|---|---|---|---|
| Catalog/visibility | public_team/public_vehicle/public_marketplace RPCs in tracked migrations | Approval/storefront gates are server predicates | Verify final deployed predicates, operator opt-in and demo exclusion |
| Quote | `supabase/functions/rent-create-booking/index.ts:133`, `public_vehicle_quote` overloads | Requotes server-side, snapshots separate charge items | Expiry/version/consent binding; never silently accept changed quote |
| Request | `supabase/functions/rent-create-booking/index.ts:162`, `20260819031937...sql:39` | Calls **create_marketplace_booking**, latest source signature has 18 arguments | Plan shorthand `rent_create_booking_atomic` is not existing source; use actual identity. Effective grants/overloads must be proven |
| Availability | busy/availability functions, latest busy-window migration | Busy displays pre/post buffers; insertion precheck uses raw half-open ranges | Shared writer serialization and consistent buffer policy |
| Operator/direct booking | `src/contexts/FleetContext.tsx` insert/update/delete paths | Direct client-side table mutations | Universal database enforcement must cover every writer |
| Import/calendar/operator tools | gcal-sync, fleet-tools, Rari and import source candidates in JSON | Several direct mutations outside renter handler | Classify all candidates; dynamic access blocks complete coverage claim |
| Blocked dates | `src/hooks/useVehicleBlockedDates.ts`, related migration policies | Authenticated insert/delete | Serialize with booking writes and enforce tenant ownership |
| Status | `public_booking_by_ref` definitions and renter edge handlers | Legacy per-booking confirmation credential | Verified customer/per-booking grants, expiry/revocation, safe hosted handoffs |
| Identity | identity-create-session/identity-webhook and renter handlers | Reuse predicates differ; email alone does not prove ownership | Establish authoritative verified customer/document expiry/reuse predicate |
| Payment/approval | rent-approve-booking/rent-checkout/rent-payment-webhook/scheduler | Operator/Exotiq payment legs advance separately | Real signed duplicate/late event tests, reconciliation and verified confirmation |
| Expiry/cleanup | rent-payment-scheduler and SQL expiry functions | State transitions release inventory | Verify applied schedules, lag/recovery, stale holds |

Latest `create_marketplace_booking` overload in `20260819031937_c36dd9f7-6487-41e5-b013-5b43663eb92d.sql` has **no explicit ACL statement in that migration**. Earlier revokes target earlier signatures. This is a specific source risk, not a claim that production allows access. Applied default privileges, role membership and denied-call tests must establish its actual access before external booking writes.

Static migration chronology also retains the preceding **17-argument** overload from `20260819024902_88d5433f-dd91-452b-bec6-da445dd77008.sql`: the next migration drops older 14/16-argument identities only. Callers supplying optional defaults without `return_time` therefore require explicit overload resolution/compatibility testing. Root's separate isolated local SQL audit reproduced a function-not-unique error and PUBLIC execute inheritance under its local baseline; that evidence does not establish the production database's role/default-privilege state. Planned hardening must preserve existing callers while retiring ambiguous signatures.

## Lifecycle evidence

`pending_documents` means identity prerequisites remain; `requested` means submitted for operator review; `pending_payment` follows approval; `confirmed` must follow authoritative settled operator and Exotiq legs plus required identity; `active` means rental underway. Legacy `pending` remains an inventory-blocking branch. `cancelled`, `expired`, `declined`, `completed` and `refunded` appear in source; precise inventory/recovery behavior is recorded per function in the JSON and must be verified against the clean applied schema. Request submission and browser payment redirect never establish confirmation.

Only dedicated synthetic staging can prove role denial, transactional concurrency, both payment legs, identity promotion and scheduled release. All remain unverified here. See staging-runbook.md for isolation, manifest scoping, historical data quarantine and owner reconciliation.

## Complete tracked-source writer candidates

| Operation | Table | Exact source | Evidence |
|---|---|---|---|
| insert | bookings | scripts/rls-verify/test_m3_public_rpcs.sql:38 | INSERT INTO public.bookings |
| insert | bookings | scripts/rls-verify/test_m5_booking_writes.sql:153 | INSERT INTO public.bookings |
| insert | bookings | scripts/rls-verify/test_m5_booking_writes.sql:163 | INSERT INTO public.bookings |
| update | bookings | scripts/rls-verify/test_m5_booking_writes.sql:170 | UPDATE public.bookings |
| update | bookings | scripts/rls-verify/test_m5_booking_writes.sql:175 | UPDATE public.bookings |
| update | bookings | src/components/dialogs/CheckInOutDialog.tsx:254 | .from("bookings") .update({ return_odometer: odoValue, return_fuel_level: fuelLevel[0], status: "completed", notes: conditionNotes ? `${booking.notes  |
| update | bookings | src/components/dialogs/CheckInOutDialog.tsx:275 | .from("bookings") .update({ pickup_odometer: odoValue, pickup_fuel_level: fuelLevel[0], status: "active", notes: conditionNotes ? `${booking.notes \|\|  |
| update | bookings | src/components/dialogs/LinkCustomerDialog.tsx:62 | .from('bookings') .update({ customer_id: customerId, customer_name: customer?.full_name \|\| currentCustomerName, customer_email: customer?.email, custo |
| update | bookings | src/components/dialogs/LinkCustomerDialog.tsx:153 | .from('bookings') .update({ customer_id: newCustomer.id, customer_name: newCustomer.full_name, customer_email: newCustomer.email, customer_phone: newC |
| update | bookings | src/components/dialogs/LinkVehicleDialog.tsx:93 | .from('bookings') .update({ vehicle_id: vehicleId, vehicle_name: null // Clear stored name once linked to actual vehicle }) .eq('id', bookingId) |
| update | bookings | src/components/dialogs/RecordPaymentDialog.tsx:306 | .from("bookings") .update({ gas_fee_waived: gasFeeWaived, total_value: financials.grandTotal, }) .eq("id", booking.id) |
| insert | bookings | src/contexts/FleetContext.tsx:832 | .from('bookings') .insert({ ...(validated as any), user_id: user.id, team_id: teamId \|\| null, pickup_location_id: (validated as any).pickup_location_i |
| update | bookings | src/contexts/FleetContext.tsx:877 | .from('bookings') .update({ customer_id: existingCustomerId }) .eq('id', insertedBooking.id) |
| update | bookings | src/contexts/FleetContext.tsx:896 | .from('bookings') .update({ customer_id: newCustomer.id }) .eq('id', insertedBooking.id) |
| update | bookings | src/contexts/FleetContext.tsx:1023 | .from('bookings') .update(updates) .eq('id', bookingId) |
| update | bookings | src/contexts/FleetContext.tsx:1046 | .from('bookings') .update({ vehicle_id: newVehicleId }) .eq('id', bookingId) |
| update | bookings | src/contexts/FleetContext.tsx:1068 | .from('bookings') .update(updates) .eq('id', bookingId) |
| update | bookings | src/contexts/FleetContext.tsx:1373 | .from('bookings') .update({ payment_status: newStatus }) .eq('id', bookingId) |
| insert | vehicle_blocked_dates | src/hooks/useVehicleBlockedDates.ts:60 | .from('vehicle_blocked_dates') .insert({ team_id: currentTeam.id, vehicle_id: input.vehicle_id, start_date: input.start_date, end_date: input.end_date |
| delete | vehicle_blocked_dates | src/hooks/useVehicleBlockedDates.ts:83 | .from('vehicle_blocked_dates') .delete() .eq('id', id) .select('id') |
| insert | bookings | supabase/functions/_shared/fleet-tools/executor.ts:3035 | .from('bookings').insert(insert).select('id, booking_ref').single() |
| update | bookings | supabase/functions/admin-smoke-run/index.ts:391 | .from("bookings") .update({ status: "requested", notes: `[GO-LIVE SMOKE ${runId}] automated payment verification` }) .eq("id", bookingId) |
| update | bookings | supabase/functions/admin-smoke-run/index.ts:616 | .from("bookings").update({ status: "cancelled" }).eq("id", booking.id) |
| update | bookings | supabase/functions/gcal-sync/index.ts:202 | .from("bookings") .update({ google_calendar_event_id: created.id }) .eq("id", booking_id) |
| update | bookings | supabase/functions/gcal-sync/index.ts:221 | .from("bookings") .update({ google_calendar_event_id: created.id }) .eq("id", booking_id) |
| update | bookings | supabase/functions/gcal-sync/index.ts:235 | .from("bookings") .update({ google_calendar_event_id: null }) .eq("id", booking_id) |
| update | bookings | supabase/functions/generate-vat-invoice/index.ts:162 | .from("bookings") .update({ invoice_number: invoiceNumber, invoice_issued_at: issuedAt }) .eq("id", booking_id) |
| update | bookings | supabase/functions/identity-webhook/index.ts:202 | .from("bookings") .update({ status: "confirmed" }) .eq("customer_id", row.customer_id) .eq("booking_source", "marketplace") .eq("status", "pending_doc |
| update | bookings | supabase/functions/identity-webhook/index.ts:216 | .from("bookings") .update({ status: "requested" }) .eq("customer_id", row.customer_id) .eq("booking_source", "marketplace") .eq("status", "pending_doc |
| delete | bookings | supabase/functions/rari-selftest/index.ts:530 | .from('bookings').delete().in('id', createdBookingIds) |
| insert | bookings | supabase/functions/rari-selftest/seed.ts:115 | .from('bookings') .insert(bookingRows) .select('id, booking_ref, customer_name') |
| delete | bookings | supabase/functions/rari-selftest/seed.ts:146 | .from('bookings').delete().eq('team_id', teamId).eq('notes', SEED_TAG) |
| delete | bookings | supabase/functions/rari-selftest/seed.ts:155 | .from('bookings').delete().in('vehicle_id', ids) |
| update | bookings | supabase/functions/rent-approve-booking/index.ts:108 | .from("bookings") .update(updates) .eq("id", bookingId) .in("status", APPROVABLE) |
| update | bookings | supabase/functions/rent-cancel-booking/index.ts:204 | .from("bookings") .update({ status: nextStatus }) .eq("id", booking.id) .in("status", CANCELLABLE) |
| update | bookings | supabase/functions/rent-extend-booking/index.ts:319 | .from("bookings") .update({ end_date: newEnd.toISOString(), total_value: Number(booking.total_value ?? 0) + addedSubtotalCents / 100, platform_fee_cen |
| update | bookings | supabase/functions/rent-payment-scheduler/index.ts:265 | .from("bookings") .update({ payment_reminder_sent_at: new Date().toISOString() }) .eq("id", booking.id) |
| update | bookings | supabase/functions/rent-payment-scheduler/index.ts:333 | .from("bookings").update({ expiry_warning_sent_at: new Date().toISOString() }).eq("id", b.id) |
| update | bookings | supabase/functions/rent-payment-webhook/index.ts:92 | .from("bookings") .update({ status: nextStatus, paid_at: paidAt, payment_stripe_mode: mode, payment_status: "paid", balance_due: 0, exotiq_charge_cent |
| update | bookings | supabase/functions/rent-payment-webhook/index.ts:320 | .from("bookings") .update({ operator_payment_intent_id: operatorPi, payment_stripe_mode: mode }) .eq("booking_ref", bookingRef) .is("operator_payment_ |
| update | bookings | supabase/functions/rent-payment-webhook/index.ts:384 | .from("bookings") .update({ exotiq_payment_intent_id: "none_required" }) .eq("booking_ref", bookingRef) |
| update | bookings | supabase/functions/rent-payment-webhook/index.ts:406 | .from("bookings").update({ exotiq_leg_attempt: attempt }).eq("id", bookingRow.id) |
| update | bookings | supabase/functions/rent-payment-webhook/index.ts:424 | .from("bookings") .update({ exotiq_payment_intent_id: exotiqPi.id }) .eq("booking_ref", bookingRef) |
| update | bookings | supabase/functions/rent-payment-webhook/index.ts:447 | .from("bookings") .update({ exotiq_payment_intent_id: pi.id }) .eq("booking_ref", bookingRef) .eq("status", "pending_payment") |
| update | bookings | supabase/functions/rent-refund-booking/index.ts:182 | .from("bookings") .update({ status: "refunded" }) .eq("id", booking.id) |
| update | bookings | supabase/functions/rent-retry-exotiq-leg/index.ts:130 | .from("bookings").update({ exotiq_leg_attempt: attempt }).eq("id", booking.id) |
| update | bookings | supabase/functions/rent-retry-exotiq-leg/index.ts:155 | .from("bookings") .update({ exotiq_payment_intent_id: exotiqPi.id }) .eq("id", booking.id) |
| update | bookings | supabase/functions/stripe-create-hold/index.ts:120 | .from("bookings").update({ deposit_hold_attempt: attempt }).eq("id", booking_id) |
| update | bookings | supabase/functions/stripe-create-hold/index.ts:225 | .from("bookings") .update({ operator_stripe_customer_id: piParams.customer as string }) .eq("id", booking_id) |
| update | bookings | supabase/functions/stripe-webhook/index.ts:268 | .from("bookings") .update({ payment_status: "partial" }) .eq("id", bookingId) |
| update | bookings | supabase/functions/stripe-webhook/index.ts:319 | .from("bookings") .update({ payment_status: "partial" }) .eq("id", pi.metadata.booking_id) |
| update | bookings | supabase/migrations/20260103041618_e83dfe77-dfcf-40b9-8ac8-53edd13ee8d8.sql:164 | UPDATE bookings |
| update | bookings | supabase/migrations/20260103050456_0e331365-a88b-4e7a-9c00-0845e8d905d0.sql:67 | update bookings |
| update | bookings | supabase/migrations/20260310002057_42f9f8a9-71ba-478d-a5ce-a7c73f7ee7b5.sql:28 | UPDATE bookings |
| update | bookings | supabase/migrations/20260528180850_716efbf0-1436-4a28-9caa-b4ed86784db4.sql:106 | UPDATE public.bookings |
| update | bookings | supabase/migrations/20260528180850_716efbf0-1436-4a28-9caa-b4ed86784db4.sql:107 | UPDATE public.bookings |
| update | bookings | supabase/migrations/20260612160047_cbb71de3-25f7-4bea-a026-7bc9cb445c70.sql:1 | UPDATE public.bookings |
| update | bookings | supabase/migrations/20260625042803_574e010c-8f40-4e40-8a0c-d3a8ee9243bc.sql:65 | UPDATE public.bookings |
| insert | bookings | supabase/migrations/20260722050000_renter_booking_writes.sql:123 | INSERT INTO public.bookings |
| insert | bookings | supabase/migrations/20260722051127_c9a90611-18bc-46ef-aa5b-566cc51c77d0.sql:108 | INSERT INTO public.bookings |
| insert | bookings | supabase/migrations/20260722181945_26aa77e2-5dba-433a-8154-1218025badb4.sql:166 | INSERT INTO public.bookings |
| update | bookings | supabase/migrations/20260724015013_c1c8f150-af28-400e-8b5d-aae1e1515305.sql:63 | UPDATE public.bookings |
| insert | bookings | supabase/migrations/20260724015047_833d2be4-ab98-42ac-9ff5-c2b73e81ba47.sql:94 | INSERT INTO public.bookings |
| update | bookings | supabase/migrations/20260724035422_6ac3ac4e-e8d6-413a-bae7-ae8d23b65ba5.sql:1 | UPDATE public.bookings |
| update | bookings | supabase/migrations/20260724202111_d32c742d-9952-4315-a1c6-c47f1fed9055.sql:28 | UPDATE public.bookings |
| update | bookings | supabase/migrations/20260725002742_ee8eaaf6-5796-470b-9ce6-1a0310c36b1b.sql:96 | UPDATE public.bookings |
| update | bookings | supabase/migrations/20260725045744_fa25b9ea-3209-4ab2-bade-3d1744f0b5b2.sql:60 | UPDATE public.bookings |
| insert | bookings | supabase/migrations/20260725135723_55e56812-5660-4871-b28f-0eebb1053389.sql:104 | INSERT INTO public.bookings |
| insert | bookings | supabase/migrations/20260727032032_2b6b4d42-5460-495d-a6d4-9c97819a8c48.sql:103 | INSERT INTO public.bookings |
| update | bookings | supabase/migrations/20260728152708_256354b7-9f0f-4e1d-a9a0-33e45ca82d04.sql:12 | UPDATE public.bookings |
| insert | bookings | supabase/migrations/20260728213053_8944d0af-68c2-4078-9bd7-3b830510aa5d.sql:204 | INSERT INTO public.bookings |
| update | bookings | supabase/migrations/20260808232431_0df95049-df6d-4eef-99e3-164b88d55f11.sql:1 | UPDATE public.bookings |
| delete | bookings | supabase/migrations/20260811172330_007452d6-279a-4260-982f-df7f2ff961c1.sql:1 | DELETE FROM public.bookings |
| insert | bookings | supabase/migrations/20260817213136_305581df-649c-4c27-9d7e-f62f7a38de28.sql:93 | INSERT INTO public.bookings |
| insert | bookings | supabase/migrations/20260818041452_1db49257-f282-499d-8cea-e2961473656a.sql:231 | INSERT INTO public.bookings |
| delete | bookings | supabase/migrations/20260818174032_c588dcbc-d611-4c10-9a51-a6a4e64fcb08.sql:2 | DELETE FROM public.bookings |
| insert | bookings | supabase/migrations/20260818194350_05657977-2db5-4065-bade-cb18f5658618.sql:132 | INSERT INTO public.bookings |
| insert | bookings | supabase/migrations/20260819024902_88d5433f-dd91-452b-bec6-da445dd77008.sql:75 | INSERT INTO public.bookings |
| insert | bookings | supabase/migrations/20260819031937_c36dd9f7-6487-41e5-b013-5b43663eb92d.sql:120 | INSERT INTO public.bookings |
| update | bookings | supabase/migrations/20261007090200_shared_inventory_guard.sql:10 | UPDATE public.bookings |

## Final static function overloads

| Identity | Last source definition | Definer | Default arguments | Privileges/deployment |
|---|---|---|---|---|
| public.agent_inventory_available(uuid,timestamptz,timestamptz) | supabase/migrations/20261007090300_inventory_policy_read_parity.sql:7 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.agent_inventory_blocked_guard() | supabase/migrations/20261007090200_shared_inventory_guard.sql:94 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.agent_inventory_booking_guard() | supabase/migrations/20261007090200_shared_inventory_guard.sql:52 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.booking_has_captured_leg(public.bookings) | supabase/migrations/20260725045744_fa25b9ea-3209-4ab2-bade-3d1744f0b5b2.sql:6 | false |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.can_access_entity(uuid,text,uuid) | supabase/migrations/20260627203747_8d7bb02a-dc52-4ebe-a4b4-35d222235278.sql:3 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text,text,bigint,bigint,bigint,bigint,bigint,text) | supabase/migrations/20260819031937_c36dd9f7-6487-41e5-b013-5b43663eb92d.sql:39 | true | _state_fee_cents bigint DEFAULT 0; _processing_fee_cents bigint DEFAULT 0; _operator_tax_cents bigint DEFAULT 0; _return_time text DEFAULT NULL | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text,text,bigint,bigint,bigint,bigint,bigint) | supabase/migrations/20260819024902_88d5433f-dd91-452b-bec6-da445dd77008.sql:1 | true | _state_fee_cents bigint DEFAULT 0; _processing_fee_cents bigint DEFAULT 0; _operator_tax_cents bigint DEFAULT 0 | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.expire_overdue_payment_bookings() | supabase/migrations/20260725045744_fa25b9ea-3209-4ab2-bade-3d1744f0b5b2.sql:36 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.expire_unverified_holds() | supabase/migrations/20260728152708_256354b7-9f0f-4e1d-a9a0-33e45ca82d04.sql:4 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.external_quote_immutable() | supabase/migrations/20261007090100_external_quote_snapshots.sql:38 | false |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.external_validate_grant_binding() | supabase/migrations/20261007090000_external_customer_grants.sql:107 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.find_holds_needing_warning() | supabase/migrations/20260728152723_a58e5413-94b3-4aab-a3e3-103f6ebb5d84.sql:5 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.fn_transition_payout(uuid,text,timestamp with time zone,text,text,text) | supabase/migrations/20260529001701_fd9f98c5-3ca0-4862-9ccf-07d536d9aaee.sql:96 | true | p_paid_at timestamp with time zone DEFAULT NULL; p_reference text DEFAULT NULL; p_method text DEFAULT NULL; p_reason text DEFAULT NULL | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.fn_vehicle_pnl(uuid,date,date) | supabase/migrations/20260731031647_7284e1ef-a621-43c5-b4d6-ad63149cb477.sql:6 | false |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.get_super_admin_marketplace_bookings(uuid,timestamptz,timestamptz) | supabase/migrations/20260828190528_0ef60d8f-85f2-43e4-aacb-39d8d6f5b8ff.sql:146 | true | _from timestamptz DEFAULT (now() - interval '30 days'); _to timestamptz DEFAULT now() | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.get_super_admin_marketplace_revenue(timestamptz,timestamptz) | supabase/migrations/20260828190528_0ef60d8f-85f2-43e4-aacb-39d8d6f5b8ff.sql:1 | true | _from timestamptz DEFAULT (now() - interval '30 days'); _to timestamptz DEFAULT now() | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.get_super_admin_platform_pulse() | supabase/migrations/20260605163938_d7ba6142-9b67-4ee4-b773-ee67a48a536e.sql:8 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.get_super_admin_stats() | supabase/migrations/20260528014214_c37ae3d3-b801-4df9-a816-61d16243a752.sql:109 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.get_super_admin_tenant_detail(uuid) | supabase/migrations/20260623184847_3d9a9862-877e-4e2d-a435-72ca5d51c1f4.sql:119 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.get_super_admin_tenant_health() | supabase/migrations/20260623184847_3d9a9862-877e-4e2d-a435-72ca5d51c1f4.sql:1 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.guard_marketplace_booking_blocked_dates() | supabase/migrations/20260901194608_e2f6eea3-4363-483c-bc1d-9cfa24d1819e.sql:153 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.guard_marketplace_confirm_transition() | supabase/migrations/20260728222252_e1512efd-4831-4168-bf31-4f4cd78358fb.sql:1 | false |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.is_marketplace_team(uuid) | supabase/migrations/20260721232856_542fce1e-1f93-4fe3-9344-c363ed48f7bd.sql:24 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.is_marketplace_vehicle(uuid) | supabase/migrations/20260721232856_542fce1e-1f93-4fe3-9344-c363ed48f7bd.sql:41 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.migrate_users_to_teams() | supabase/migrations/20260103041618_e83dfe77-dfcf-40b9-8ac8-53edd13ee8d8.sql:72 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.notify_new_payment() | supabase/migrations/20260208224404_510922e8-1aad-4fbb-848a-74abb2ae8dec.sql:79 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_booking_by_ref(text,uuid) | supabase/migrations/20260818194350_05657977-2db5-4065-bade-cb18f5658618.sql:198 | true | _token uuid DEFAULT NULL::uuid | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_fleet_busy(date,date,text) | supabase/migrations/20261007090300_inventory_policy_read_parity.sql:68 | true | _team_slug text DEFAULT NULL | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_marketplace_fleet() | supabase/migrations/20260904010919_d719f530-aba2-426e-ae4f-daa09195bcc9.sql:51 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_marketplace_teams() | supabase/migrations/20260903234727_aa508e81-d609-44ce-91f2-e6f575345111.sql:31 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_team_by_slug(text) | supabase/migrations/20260818194350_05657977-2db5-4065-bade-cb18f5658618.sql:172 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_team_fleet(text,boolean) | supabase/migrations/20260904010919_d719f530-aba2-426e-ae4f-daa09195bcc9.sql:15 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_vehicle_availability(text,text,date,date) | supabase/migrations/20261007090300_inventory_policy_read_parity.sql:57 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_vehicle_busy_windows(text,text,date,date) | supabase/migrations/20261007090300_inventory_policy_read_parity.sql:31 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_vehicle_by_slug(text,text) | supabase/migrations/20260904010919_d719f530-aba2-426e-ae4f-daa09195bcc9.sql:93 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.public_vehicle_quote(text,text,date,date,jsonb) | supabase/migrations/20260901194608_e2f6eea3-4363-483c-bc1d-9cfa24d1819e.sql:42 | true | _options jsonb DEFAULT '{}'::jsonb | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| public.trash_vehicle(uuid) | supabase/migrations/20260527223011_1c12cfb6-0778-424d-8580-94b266a4844d.sql:125 | true |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |
| update_customer_stats() | supabase/migrations/20260406200024_5f6c6517-ff2d-4972-8b0b-fffd16550646.sql:2 | false |  | Applied privileges and deployment unverified; all historical ACL statements in JSON |

## Dynamic table candidates requiring explicit applied-schema coverage

| Source | Expression | Coverage disposition |
|---|---|---|
| src/components/import/ImportWizard.tsx:286 | .from(selectedEntity) | Booking INSERT/UPDATE source path; include import writes |
| src/components/import/ImportWizard.tsx:306 | .from(selectedEntity) | Booking INSERT/UPDATE source path; include import writes |
| src/lib/importDuplicateCheck.ts:108 | .from(entityType) | Read-only source path; verify no associated side effects |
| supabase/functions/confirm-data-deletion/index.ts:118 | .from(item.table) | Bookings DELETE exists in deletionOrder; include team deletion/cascade proof |
| supabase/functions/confirm-data-deletion/index.ts:130 | .from(item.joinTable) | Bookings DELETE exists in deletionOrder; include team deletion/cascade proof |
| supabase/functions/confirm-data-deletion/index.ts:137 | .from(item.table) | Bookings DELETE exists in deletionOrder; include team deletion/cascade proof |
| supabase/functions/confirm-data-deletion/index.ts:150 | .from(item.table) | Bookings DELETE exists in deletionOrder; include team deletion/cascade proof |
| supabase/functions/dsr-erase/index.ts:202 | .from(t.table) | Bookings PII UPDATE via CUSTOMER_TARGETS; include preservation/authorization tests |
| supabase/functions/dsr-erase/index.ts:226 | .from(t.table) | Bookings PII UPDATE via CUSTOMER_TARGETS; include preservation/authorization tests |
| supabase/functions/dsr-erase/index.ts:233 | .from(t.table) | Bookings PII UPDATE via CUSTOMER_TARGETS; include preservation/authorization tests |
| supabase/functions/dsr-export/index.ts:151 | .from(t.table) | Read-only source path; verify no associated side effects |
| supabase/functions/dsr-export/index.ts:169 | .from(t.table) | Read-only source path; verify no associated side effects |
| supabase/functions/retention-sweeper/index.ts:98 | .from(map.table) | Current ENTITY_TABLE excludes bookings/blocked dates; rerun audit on changes |
| supabase/functions/retention-sweeper/index.ts:113 | .from(map.table) | Current ENTITY_TABLE excludes bookings/blocked dates; rerun audit on changes |
