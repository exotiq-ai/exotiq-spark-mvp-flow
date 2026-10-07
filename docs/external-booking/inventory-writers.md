# Shared inventory policy and writer coverage

Source-only inspection plus actual PostgreSQL tests on a partial synthetic schema.
Applied Supabase schema, deployed privileges, RLS/cascades, provider and calendar
compatibility remain release gates. This migration does not enable external writes.

## Policy

Every booking source uses blocking statuses `requested`, `pending_documents`,
`pending_payment`, `pending`, `confirmed`, `active`. `is_historical=true` never
overrides a blocking status. Correct historical imports must carry a terminal
status. Timestamp expiry alone never releases a row; the actual terminal status
transition does. Quote creation is read-only inventory observation, not a hold.

A rental blocks `[start, return + inventory_buffer_minutes)`. Each reservation
snapshots its vehicle's tenant buffer on creation, default 60 minutes; date/status
edits retain it, vehicle moves derive the new vehicle policy. A later tenant policy
change affects new reservations only. The field is not caller-controlled. Existing
rows necessarily reconstruct their snapshot from current tenant policy; deployment
review must record this uncertainty and audit conflicts before migration.

Bookings conflict exactly when those half-open ranges overlap. Next pickup at
previous return plus buffer is permitted. Only the preceding reservation's buffer
applies at that boundary. Maintenance blocks use raw `[start,end)` with no extra
buffer. They may overlap each other; their union is unavailable. A rental's trailing
turnaround cannot intersect a maintenance block. Timestamps are instants; convert
customer wall clocks using tenant IANA timezone before calling the policy. DST
gaps/folds need explicit input resolution in the API, not server session timezone.

## Concurrency and retries

`agent_inventory_lock(uuid,uuid)` takes transaction-scoped, sorted old/new vehicle
advisory keys on all INSERT/UPDATE/DELETE operations on bookings and blocked dates.
Keys include a namespace; hash collisions cause safe extra contention. VOLATILE
guard queries use fresh snapshots under READ COMMITTED. Repeatable-read and
serializable fixed-snapshot transactions are explicitly refused with SQLSTATE
`40001` and must restart under READ COMMITTED for these writes.

Locks are tried, never waited on. PostgreSQL acquires an UPDATE row lock before
its row trigger; waiting on an advisory key then can create a cycle with another
transaction holding that key and needing the row. Immediate `40001` abort breaks
that cycle. All writes are atomic: retry the whole transaction, not a remaining
statement/savepoint, with a bounded count and jitter. Task 01-06 owns API retry
mapping and durable request idempotency; existing operator/import callers need
equivalent bounded retry handling before rollout. A committed conflict returns
`23P01` / `dates_unavailable` and is not retried as an identical reservation.

BEFORE triggers derive immutable snapshots and validate; AFTER triggers recheck
the final row after other BEFORE triggers. Same-transaction repeated and multirow
overlaps abort without partial rows. Existing marketplace GiST exclusion stays.
No widened exclusion, historical cleanup, or data deletion is performed here.

Privileged actors can disable triggers, use replication-role bypass or TRUNCATE;
the trigger is not a defense against a database owner. Audit and restrict those
rights and source bypass paths in staging. RLS authorization remains independent.
FK-cascade deletes/updates and all preexisting triggers need applied-schema proof.

## Before/after read compatibility gate

| Case | Existing source read/write divergence | New policy |
|---|---|---|
| Rental 10:00–10:00 next day, buffer 60 | Busy windows expand before/after; insertion raw interval | Busy exactly 10:00–11:00 next day; pickup at 11:00 allowed |
| Changed tenant buffer | Reads retroactively use tenant value | Existing reservation keeps its snapshot |
| Maintenance 12:00–15:00 | INSERT marketplace guard only | All writer/edit paths reject overlap; next rental may begin 15:00 |
| Expired but untransitioned request | Blocking source status exists | Still blocks until actual cancellation/terminal transition |
| Imported blocking historical row | Some reads ignore it | Remains blocked, matching all-source write guard |

Day-granular RPCs remain conservative discovery projections: they cannot promise
an exact pickup time. The precise busy-window RPC includes maintenance intervals
and buffers already applied. Consumers must not add another buffer. Public fleet
listing scope remains unchanged: fleet-wide requires marketplace_listed; scoped
calls retain team filtering, both enforce existing vehicle visibility/unlisted
rules. No browse/visibility opt-in is switched on by this migration.

Frontend storefront and operator calendar compatibility must be tested in isolated
frontend worktrees with the precise RPC and date projection. No claim is made from
backend SQL alone. Quote/request authorities must call `agent_inventory_available`
with exact instants before relying on a quote; guard remains final write authority.
Plan 01-04 integrates the shared check in quote creation; plan 01-06 integrates
request creation. Existing raw quote RPC is arithmetic only, not an availability
promise or hold. Its itemized charges and shape are preserved.

## Preflight conflict report (read-only, reviewed staging)

Before any deployment, report cross-source pairs using the reconstructed current
policy and manually resolve them with operator review. Do not delete conflicts or
silently expand an exclusion over existing data. Query also reports reservations
overlapping maintenance using the same half-open ranges. Review orphan vehicles,
invalid/infinite intervals, buffer values outside 0–10080, cascades, all final
triggers/constraints, and effective permissions/default ACLs.

```sql
WITH r AS (
 SELECT b.id,b.vehicle_id,b.start_date,b.end_date,b.booking_source,
   tstzrange(b.start_date,b.end_date+make_interval(mins=>coalesce(t.rental_buffer_minutes,60)),'[)') span
 FROM public.bookings b JOIN public.vehicles v ON v.id=b.vehicle_id
 JOIN public.teams t ON t.id=v.team_id
 WHERE b.status IN ('requested','pending_documents','pending_payment','pending','confirmed','active')
)
SELECT a.id,b.id,a.booking_source,b.booking_source
FROM r a JOIN r b ON a.vehicle_id=b.vehicle_id AND a.id<b.id AND a.span && b.span;
-- Also join r to vehicle_blocked_dates by vehicle_id and overlapping raw range.
```

## Audited paths

The baseline source inventory is `source-audit.json` with exact line/hash evidence:
79 direct writer candidates and 14 dynamic table candidates at source base f8674e13.
Some are historical migrations/tests, not active deployed writers. Final function
overloads, privileges, trigger and policy candidates are enumerated there; root
regenerates the audit after merged changes. The table triggers cover underlying
INSERT/UPDATE/DELETE regardless of which RPC, Edge function or client reaches them.

| Writer family | Coverage | Separate proof required |
|---|---|---|
| create_marketplace_booking retained 17/18 overloads | Final booking INSERT guarded | Caller compatibility, exact grants and retirement owned by 01-06 |
| Operator/direct booking clients | INSERT/UPDATE/DELETE guarded | Actual roles, UI retries and confirmation rules |
| ImportWizard dynamic bookings INSERT/UPDATE | Same triggers | Historical terminal state mapping and transactional retries |
| Manual blocked-date/calendar editors | INSERT/UPDATE/DELETE guarded | RLS team ownership and date interpretation |
| expire_unverified_holds / payment expiry | UPDATE guarded and serialized | Financial-leg guard/scheduler recovery owned by 01-06 |
| confirm-data-deletion dynamic team deletion | Booking DELETE guarded | Effective cascade paths and deletion permissions |
| dsr-erase CUSTOMER_TARGETS | Booking PII UPDATE guarded | Preservation of inventory/financial state and authorization |
| dsr-export / importDuplicateCheck | Read-only candidates | Confirm no write side effects |
| retention-sweeper ENTITY_TABLE | Currently excludes inventory | Reaudit if mapping changes |

For the complete individual writer list, see capabilities.md and source-audit.json.
The database safety boundary does not depend on agents voluntarily using an RPC.
No service-role credentials or raw identity/payment data are exposed by these helpers.
