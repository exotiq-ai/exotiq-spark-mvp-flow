
## My take

Yes — sending users to just the module page is the weakest link in an otherwise clean brief. The whole promise of "Needs you" is "tap → I'm already where the work is." A module landing makes the user hunt again, which kills the calm-command feel.

Good news: `useDailyBrief` already attaches the right ids on every issue via `meta` (bookingId, taskId, damageClaimId, vehicleId, amount). We just aren't using them — `DailyBriefCard` only forwards `issue.module` to `onModuleClick`.

## Plan: route each issue to its exact record

Use the existing `useModuleNavigation` helpers (already the canonical deep-link layer used elsewhere in the app — same query-param shape Bookings/Fleet/Vault read) so we don't invent a parallel routing scheme.

### Mapping (issue id → destination)

| Issue | Destination | Helper |
|---|---|---|
| `overdue-returns` | Booking detail (returns tab) | `goToBookingDetails(meta.bookingId)` |
| `pending-confirmations` | Booking detail | `goToBookingDetails(meta.bookingId)` |
| `outstanding-balance` | Booking → Payments | `goToPayments(meta.bookingId)` |
| `overdue-tasks` | Specific task | `goToTask(meta.taskId)` |
| `urgent-tasks` | Specific task | `goToTask(meta.taskId)` |
| `open-damage` | Damage report | `goToDamageReport(meta.damageClaimId)` |
| `maintenance` | Fleet → Maintenance tab | `goToMaintenance()` |
| `pricing-opportunity` | MotorIQ vehicle detail | `navigate(moduleIdToPath('motoriq', { vehicleId: meta.vehicleId }))` |

Fallback: if `meta` is missing for any reason, fall back to the current module-level navigation so nothing becomes a dead button.

### Implementation (single file, ~30 lines)

1. **`src/components/dashboard/DailyBriefCard.tsx`**
   - Drop the `onModuleClick` prop dependency for issue rows; add an internal `handleIssueClick(issue)` that switches on `issue.id` (or `issue.category` + `meta`) and calls the right helper from `useModuleNavigation`.
   - Keep `onModuleClick` on the component signature for backward compat (still used elsewhere if needed), but bypass it for issue rows.
   - Multi-record issues (e.g. 3 overdue returns): `meta.bookingId` is the first one — that's fine for v1 and matches how Notifications behaves today. When count > 1, append a small "+N more" affordance under the row that falls back to `goToBookingDetails` with no id (lands on filtered list). Optional — can defer if you'd rather keep the row strictly single-tap.

2. **No changes** to `useDailyBrief` (meta is already there), no changes to `DashboardOverviewEnhanced`, no new routes.

### Edge cases handled
- Missing id → module-level fallback, no dead click.
- Cancelled/stale booking id → existing booking detail route already handles "not found" gracefully.
- Pricing opportunity row only renders when `aiInsight.vehicleId` exists, so deep link is always valid.

### Verification
- Click each of the 8 issue types in `/demo` with `ff_dailyBrief=1` and confirm the URL lands on the exact record (booking dialog open, task drawer open, etc.), not the module index.
- Flag-off path untouched.

### Out of scope (flagging for later, not doing now)
- A "+N more" expanded list per category (e.g. all 3 overdue returns inline) — nice but bloats the brief; current "show top 5 / view all" already covers it.
- Inline one-tap actions (Confirm / Mark paid / Snooze) right on the row — high-impact but a separate design pass; would want confirm-state + undo toast.
