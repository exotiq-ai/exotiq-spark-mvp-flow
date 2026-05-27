# Vehicle Deletion, Restoration & Billing Integrity

## Goals

1. Make accidental loss of a vehicle (and its booking/inspection/photo history) effectively impossible.
2. Establish a clear two-tier model: **Archive** (everyday, reversible, free) vs **Delete** (rare, Owner-only, recoverable for 30 days, then purged).
3. Prevent renewal-gaming on per-vehicle subscription tiers using **peak-count billing** + trash-counts-as-seats + 30-day VIN cooldown.
4. Preserve historical references everywhere — a deleted vehicle still resolves to its name on past bookings, inspections, damage claims, and CRM records.
5. Ship matching customer-facing copy (buttons, dialogs, tooltips, toasts, settings) using the agreed layman language so support and UI tell the same story.

---

## Behavior model

### Two states beyond "active"

| State | Who can set | Visible where | Counts toward billing | Reversible |
|---|---|---|---|---|
| **Active** | Manager+ | Everywhere | Yes | n/a |
| **Archived** | Manager+ | Settings → Archived list only; historical records resolve name | No | Yes, one-click restore |
| **Trashed** (pre-purge) | Owner only | Settings → Trash (Owner-only view); historical records resolve name | **Yes**, until purge date | Yes, by Owner only |
| **Purged** | Auto, 30d after trash | Nowhere; historical records show last-known name from snapshot | No | No |

Key distinctions:
- **Archive** = "I'm not running this car right now" (seasonal, sold off, paused). Free, reversible, manager-level.
- **Trash** = "I want this gone." Owner-only, 30-day grace, still billed during grace.
- Existing `status='retired'` is folded into Archived during migration (one-time backfill).

### Linked-data behavior (trashed or purged)
- Hidden from: Fleet grid, Calendar, Map, Photo Hub active lists, Pricing, Maintenance new-task pickers.
- Still resolves name in: Bookings list/detail, Inspections, Damage Claims, CRM customer LTV, Margin reports, audit logs.
- **Archive** is allowed with future bookings (vehicle just disappears from new-booking pickers; existing bookings remain).
- **Delete** is blocked if active or future bookings exist — user must cancel or complete them first.

---

## Permissions (RBAC)

Uses existing 5-level role system:

| Action | Owner | Admin | Manager | Staff | Viewer |
|---|---|---|---|---|---|
| Archive vehicle | ✓ | ✓ | ✓ | — | — |
| Restore from Archive | ✓ | ✓ | ✓ | — | — |
| Move to Trash (delete) | ✓ | — | — | — | — |
| Restore from Trash | ✓ | — | — | — | — |
| Purge immediately (skip 30d) | ✓ | — | — | — | — |
| View Trash | ✓ | — | — | — | — |

Existing delete button on `FleetVehicleCard` becomes role-aware. The 5-second undo toast is **removed** for delete (replaced by 30-day Trash). Kept as a nicety for Archive.

If a non-Owner attempts Delete (stale UI, shortcut): show "Owner approval needed" dialog with "Archive instead" CTA — never a silent failure or false affordance.

---

## Billing model (per-vehicle tiers only)

**Rule:** Subscription quantity at renewal = **MAX(active + trashed vehicle count)** observed across the billing cycle. Trash counts; archive does not.

- Daily snapshot job writes `(team_id, snapshot_date, active_count, trashed_count, total_billable)` per team.
- At Stripe renewal: subscription item quantity set to peak `total_billable` over the cycle.
- **VIN cooldown:** if a vehicle is purged and the same VIN reappears within 30 days, the prior peak floor carries into the new cycle. Closes the "purge then re-add" loophole.
- Flat tiers (Base + Overage) unaffected — overage already behaves peak-like.

**Why peak-count:** SaaS standard (Salesforce/HubSpot pattern), one-sentence invoice line, eliminates day-29-delete gaming without elaborate enforcement, and rewards genuine downsizing in the *next* cycle.

**Communicated in-app:** "You're billed for the most vehicles you had in your fleet this cycle. Archived vehicles don't count. Trashed vehicles still count until permanently deleted — this keeps pricing predictable and prevents accidental downgrades."

---

## UX flow

### Archive (Manager+)
1. Vehicle card → ⋯ menu → **Archive vehicle**
2. Confirm: "Hide from your active fleet. History stays. Restore anytime. Not billed."
3. Toast: "Archived. Restore anytime from Settings → Archived." [Undo]

### Delete (Owner only)
1. Vehicle card → ⋯ menu → **Delete vehicle…** (destructive red, trailing ellipsis)
2. Pre-flight: if active/future bookings exist → blocking dialog "Cancel or complete bookings before deleting."
3. Destructive confirmation (per existing cancellation-guard pattern):
   - "Delete {Vehicle name}?"
   - Body: 30-day Trash explanation + history-preserved note + billing-still-counts heads-up.
   - Type vehicle name to confirm.
4. Toast: "Moved to Trash. Auto-removes {date}." [View Trash]

### Settings → Archived (Manager+)
List with restore action. Header: "Archived vehicles are hidden from your fleet but keep their full history. Restore anytime."

### Settings → Trash (Owner-only route)
List with name, trashed date, auto-purge date, **Restore** and **Delete permanently now** actions. "Delete permanently now" requires a second destructive confirm + note "Your next bill won't include this vehicle starting next cycle."

### Historical name resolution
All views joining `vehicle_id` use coalesce: live name → `last_known_name` snapshot → "Deleted vehicle".

---

## Customer-facing copy (locked)

**Button labels:** "Archive vehicle" (Manager+), "Delete vehicle…" (Owner, destructive).

**Tooltips:**
- Archive: "Hide from your active fleet. History stays. Restore anytime."
- Delete: "Send to Trash for 30 days, then permanently remove. Owner only."

**Dialogs, toasts, empty states, and the permission-blocked variant** all use the language drafted with the user — see the implementation tickets for the full strings. Same vocabulary across email support, buttons, dialogs, and toasts.

---

## Out of scope (this pass)

- Changing flat-tier overage logic (already peak-like).
- Bulk UI redesign — existing batch action repoints to batch-archive (Manager) / batch-delete-to-trash (Owner).
- Trashed vehicles as a CSV import target.
- Mid-cycle Stripe proration — reconciles only at renewal via peak snapshot.
- Stripe invoice line-item description tweak (separate follow-up).

---

## Technical notes (for implementation)

**Schema (migration):**
- `vehicles.archived_at TIMESTAMPTZ NULL`
- `vehicles.trashed_at TIMESTAMPTZ NULL`
- `vehicles.purge_at TIMESTAMPTZ NULL` (computed `trashed_at + 30 days` on trash)
- `vehicles.last_known_name TEXT` (snapshot at trash/purge time)
- One-time backfill: `UPDATE vehicles SET archived_at = now() WHERE status = 'retired'`.

**New tables:**
- `vehicle_billing_snapshots (team_id, snapshot_date, active_count, trashed_count, total_billable)` — daily rollup.
- `purged_vehicle_fingerprints (team_id, vin, purged_at, prior_peak)` — for 30-day VIN cooldown. Index `(team_id, vin)`.

**RLS:**
- Trash queries gated by `is_team_owner(auth.uid(), team_id)` (existing security-definer function).
- Archive queries gated by `is_team_admin` or higher (covers Owner + Admin + Manager via existing helper).

**Jobs:**
- Daily edge function / pg_cron: snapshot active + trashed counts per team.
- Daily: purge vehicles where `purge_at < now()`; copy fingerprint to `purged_vehicle_fingerprints`.
- On Stripe renewal webhook (or pre-invoice cron): set subscription item quantity to peak `total_billable` over the cycle; apply VIN cooldown floor if applicable.

**Frontend hot spots:**
- `src/components/fleet/FleetVehicleCard.tsx` — split delete into Archive (Manager+) and Delete (Owner only), role-aware via `useUserRole`.
- `src/components/fleet/FleetPageEnhanced.tsx` — remove 5-second hard-delete pattern for delete; keep undo toast for archive only; repoint batch action.
- `src/hooks/useLocationFilteredFleet.ts` — exclude `archived_at IS NOT NULL` and `trashed_at IS NOT NULL` from default queries; add `includeArchived` / `includeTrashed` opts.
- New `src/pages/settings/ArchivedVehicles.tsx` (Manager+) and `src/pages/settings/TrashedVehicles.tsx` (Owner only, route-guarded).
- Booking/inspection/CRM list components: coalesce vehicle name with `last_known_name`.
- `vehicle_change_log` writes for every archive, restore, trash, purge, auto-purge with actor + reason.

**Memory updates after ship:**
- New memory `mem://fleet/deletion-and-archive-model` summarizing the two-tier model + permissions.
- Update `mem://fleet/status-management` — `retired` deprecated in favor of `archived_at`.
- New memory `mem://integrations/stripe-subscription-logic` addition — peak-count rule + VIN cooldown.
