## M5 Renter Booking Backend Apply

### 1. Apply migration `20260722050000_renter_booking_writes.sql`
Pre-checked repo file (205 lines) and current DB state:
- No existing marketplace-source overlapping rows (0 conflicts against the proposed exclusion predicate) — exclusion constraint will apply cleanly.
- `bookings.booking_source` column exists; `confirmation_token` and `booking_ref` index will be added idempotently.
- New CHECK values: `requested`, `pending_documents`, `pending_payment`, `declined`, `refunded`.

Apply via `supabase--migration` with the file's SQL exactly as written.

### 2. Post-apply verification (read-only)
- (a) Insert-probe a bogus status (`'bogus'`) — expect CHECK violation; insert one of the new statuses — expect accepted (rolled back).
- (b) `pg_catalog` probe: confirm `create_marketplace_booking(...)` has no EXECUTE for `anon`/`authenticated` (migration REVOKEs both plus PUBLIC).
- (c) Confirm `public_booking_by_ref(text, uuid)` has EXECUTE for `anon` and `authenticated` (migration GRANTs both).
- (d) Print `proacl` for both new functions; add explicit grants ONLY if `public_booking_by_ref` is missing EXECUTE for anon/authenticated.

### 3. Deploy edge function `rent-create-booking`
Use `supabase--deploy_edge_functions` for `rent-create-booking`. Then `supabase--curl_edge_functions` POST with empty body → expect HTTP 400 with `team_slug and vehicle_slug are required`.

### 4. Security linter
Run `supabase--linter` and diff against expected baseline — report any new findings introduced by this migration (btree_gist extension warning, function search_path, etc.).

### 5. UI status-mapping report (no code changes)
Grep the codebase for booking status maps/switches and list every location that will need to render the five new statuses (`requested`, `pending_documents`, `pending_payment`, `declined`, `refunded`). Files likely affected: `EnhancedBookingDialog`, `BookingCalendar`, status badge helpers, filters. Report as a list only — no edits this task.

### Rollback note
If the exclusion constraint unexpectedly fails at apply time, STOP and report conflicting `(vehicle_id, start_date, end_date, status)` rows before doing anything else.
