## Diagnosis

Pulse module **is working correctly** — it reads live data from `bookings` + `payments`:
- **Pickups Today** = confirmed bookings where `start_date::date = today`
- **Returns Today** = confirmed/completed bookings where `end_date::date = today`
- **Vehicles Out** = confirmed bookings spanning now
- **Collected Today** = payments with `transaction_date::date = today`

The screen looks light because the prior 6-month seed started on **June 1, 2026** — today (May 31) has **0 pickups, 0 returns, 1 vehicle out**. So Pulse has nothing to display, not a bug.

## Fix

Insert realistic same-day activity for the `hello@exotiq.ai` demo team (`c1de6533-…`) across both markets. All rows tagged `[DEMO-6MO-FWD]` for rollback.

### Today's seed targets (May 31, 2026)

Fleet split: Scottsdale 9 vehicles, Miami/Miami Beach/Ft Lauderdale 46 vehicles.

| Market | Pickups today | Returns today | Hero "Vehicles Out" boost |
|---|---|---|---|
| Scottsdale | 2 | 2 | +2 active rentals (started 1-3d ago, end in 2-5d) |
| Miami | 9 | 8 | +12 active rentals (started 1-4d ago, end in 2-6d) |

Tier rules respected: hypercars capped (≤10% util), bias toward exotic/luxury/SUV.

### What gets inserted

1. **Pickups** — `status='confirmed'`, `start_date = today + random hour (9am–6pm)`, `end_date = today + 2–5 days`, customer pulled from existing demo customers, vehicle picked from idle vehicles in that market not already booked today.
2. **Returns** — `status='confirmed'`, `start_date = today − 2..5 days`, `end_date = today + random hour (10am–7pm)`. ~30% flipped to `status='completed'` to populate "X completed" subtext.
3. **Active mid-rentals** — `status='confirmed'`, spans today, populates Fleet Status "Booked" ring and "Vehicles Out" card.
4. **Today's payments** — one `deposit` payment per new pickup (`payment_status='succeeded'`, `transaction_date=now()`) so "Collected Today" card shows a believable 4–5 figure for May 31 instead of staying at $0 / spiking.

### Guardrails

- No overlap with existing bookings (check `vehicle_id` + date range before insert).
- Hypercars (Bugatti, Koenigsegg, etc.) excluded unless their forward-window util is still under 10%.
- All rows carry `notes ILIKE '%[DEMO-6MO-FWD]%'` for one-click rollback.
- Only touches the demo team; no production data, no app code, no schema.

### Out of scope

- No changes to Pulse component code (it's working).
- No PredictHQ event layer (still 401).
- No changes to `vehicles.status` or `utilization` columns.

### Verification after run

Re-query and confirm Pulse will render:
- Pickups Today: ~11 (Scottsdale 2 + Miami 9)
- Returns Today: ~10
- Vehicles Out: ~15
- Collected Today: realistic non-zero
