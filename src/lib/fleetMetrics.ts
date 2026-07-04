/**
 * fleetMetrics — single source of truth for dashboard KPI definitions.
 *
 * All dashboard components (Daily Brief, Weekly Digest, KPI Rail, Pulse Strip,
 * Today Snapshot) MUST route through these helpers instead of inlining status
 * filters. Every drift between filters is a defect: two cells that mean the
 * same thing must return the same number.
 *
 * Concepts:
 *   • On-rent  — vehicle is out with a paying customer right now.
 *                Statuses: 'confirmed' | 'active'. `pending` is not booked,
 *                `completed` has been returned.
 *   • Pickups  — a booking whose start_date is that day (leading indicator,
 *                includes `pending` so ops can prep even unconfirmed slots).
 *   • Returns  — a booking whose end_date is that day (`confirmed | active`).
 *   • Booked   — Σ total_value of pickups on that day. Cash not yet received.
 *   • Collected — Σ payments.amount whose transaction_date is that day.
 *                 This is the cash number.
 */

export const ON_RENT_STATUSES = ['confirmed', 'active'] as const;
export const PICKUP_STATUSES = ['confirmed', 'pending', 'active'] as const;
export const RETURN_STATUSES = ['confirmed', 'active'] as const;

type Statusish = string | null | undefined;

interface BookingLike {
  status?: Statusish;
  start_date: string | Date;
  end_date: string | Date;
  vehicle_id?: string | null;
  total_value?: number | string | null;
}

interface PaymentLike {
  transaction_date?: string | Date | null;
  amount?: number | string | null;
}

const asDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

export const isOnRentStatus = (s: Statusish): boolean =>
  (ON_RENT_STATUSES as readonly string[]).includes(String(s ?? ''));

export const isPickupStatus = (s: Statusish): boolean =>
  (PICKUP_STATUSES as readonly string[]).includes(String(s ?? ''));

export const isReturnStatus = (s: Statusish): boolean =>
  (RETURN_STATUSES as readonly string[]).includes(String(s ?? ''));

/** True when the booking is on-rent at instant `at`. */
export const isOnRentAt = (b: BookingLike, at: Date): boolean =>
  isOnRentStatus(b.status) && asDate(b.start_date) <= at && asDate(b.end_date) >= at;

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Unique vehicle ids on-rent at `at`. */
export const onRentVehicleIdsAt = (bookings: BookingLike[], at: Date): Set<string> => {
  const ids = new Set<string>();
  for (const b of bookings) {
    if (!isOnRentAt(b, at)) continue;
    if (b.vehicle_id) ids.add(b.vehicle_id);
  }
  return ids;
};

/** Bookings whose pickup (start) falls on `day`. */
export const pickupsOnDay = <T extends BookingLike>(bookings: T[], day: Date): T[] =>
  bookings.filter(
    (b) => isPickupStatus(b.status) && isSameDay(asDate(b.start_date), day),
  );

/** Bookings whose return (end) falls on `day`. */
export const returnsOnDay = <T extends BookingLike>(bookings: T[], day: Date): T[] =>
  bookings.filter(
    (b) => isReturnStatus(b.status) && isSameDay(asDate(b.end_date), day),
  );

/** Σ total_value of pickups on `day`. Leading indicator; not cash. */
export const sumBookedForPickupsOn = (bookings: BookingLike[], day: Date): number =>
  pickupsOnDay(bookings, day).reduce((sum, b) => sum + num(b.total_value), 0);

/** Σ payments.amount whose transaction_date is on `day`. Cash collected. */
export const sumCollectedOnDay = (payments: PaymentLike[], day: Date): number => {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  let total = 0;
  for (const p of payments) {
    if (!p.transaction_date) continue;
    const td = asDate(p.transaction_date);
    if (td >= dayStart && td <= dayEnd) total += num(p.amount);
  }
  return total;
};
