import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { useMarginFilters } from "./MarginFiltersContext";

export interface FilteredBooking {
  id: string;
  vehicle_id: string | null;
  total_value: number;
  platform_fee_amount: number;
  booking_source: string | null;
  status: string;
  start_date: string;
  end_date: string;
  customer_name: string;
  booking_ref: string | null;
}

export interface FilteredPayment {
  id: string;
  booking_id: string | null;
  amount: number;
  payment_type: string | null;
  payment_status: string | null;
  transaction_date: string | null;
  created_at: string;
}

// Bookings that count toward margin/P&L. Pending = still a quote → excluded.
// Cancelled/declined → excluded. Everything else (confirmed, active, completed) counts.
export const REVENUE_EXCLUDED_STATUSES = new Set(['pending', 'cancelled', 'declined', 'quote', 'draft']);
export const countsForRevenue = (status: string | null | undefined) =>
  !REVENUE_EXCLUDED_STATUSES.has(String(status ?? '').toLowerCase());


export interface FilteredExpense {
  id: string;
  vehicle_id: string | null;
  location_id: string | null;
  expense_type: string;
  amount: number;
  expense_date: string;
  source_module: string;
  is_reimbursable: boolean | null;
  reimbursed_amount: number | null;
}

export interface FilteredPayout {
  id: string;
  vehicle_id: string | null;
  partner_id: string;
  status: string;
  net_to_partner: number;
  paid_at: string | null;
  created_at: string;
}

interface State {
  loading: boolean;
  bookings: FilteredBooking[];
  payments: FilteredPayment[];
  expenses: FilteredExpense[];
  payouts: FilteredPayout[];
  vehicleLocationMap: Record<string, string | null>;
}

// Drive Exotiq matches either canonical value
const sourceMatches = (s: string | null, picked: string[]) => {
  if (picked.length === 0) return true;
  const normalized = s === "drive_exotiq" ? "marketplace" : (s || "direct");
  const pickedNorm = picked.map((p) => (p === "drive_exotiq" ? "marketplace" : p));
  return pickedNorm.includes(normalized);
};

export function useMarginData(): State {
  const { currentTeam } = useTeam();
  const f = useMarginFilters();
  const [state, setState] = useState<State>({
    loading: true,
    bookings: [],
    payments: [],
    expenses: [],
    payouts: [],
    vehicleLocationMap: {},
  });

  useEffect(() => {
    if (!currentTeam?.id) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      const startIso = f.start.toISOString();
      const endIso = f.end.toISOString();
      const startDay = startIso.slice(0, 10);
      const endDay = endIso.slice(0, 10);

      const [vehRes, bRes, expRes, payoutRes, pendingPayoutRes] = await Promise.all([
        supabase.from("vehicles").select("id, location_id").eq("team_id", currentTeam.id),
        // Overlap-based booking window: a booking counts if any portion falls in [start, end]
        supabase
          .from("bookings")
          .select("id, vehicle_id, total_value, platform_fee_amount, booking_source, status, start_date, end_date, customer_name, booking_ref, payment_stripe_mode")
          .eq("team_id", currentTeam.id)
          .lte("start_date", endIso)
          .gte("end_date", startIso)
          // M6a: exclude sandbox test-mode payment rows from ledger/margin views
          .or("payment_stripe_mode.is.null,payment_stripe_mode.neq.test"),
        supabase
          .from("vehicle_expenses")
          .select("id, vehicle_id, location_id, expense_type, amount, expense_date, source_module, is_reimbursable, reimbursed_amount, status")
          .eq("team_id", currentTeam.id)
          .eq("status", "confirmed")
          .gte("expense_date", startDay)
          .lte("expense_date", endDay),
        // Payouts paid within window (drives "Paid in period" reporting)
        supabase
          .from("partner_payouts")
          .select("id, vehicle_id, partner_id, status, net_to_partner, paid_at, created_at")
          .eq("team_id", currentTeam.id)
          .gte("created_at", startIso)
          .lte("created_at", endIso),
        // Pending obligations are timeless — surface any pending/scheduled payout for the team.
        supabase
          .from("partner_payouts")
          .select("id, vehicle_id, partner_id, status, net_to_partner, paid_at, created_at")
          .eq("team_id", currentTeam.id)
          .in("status", ["pending", "scheduled"]),
      ]);
      if (cancelled) return;

      const vehicleLocationMap: Record<string, string | null> = {};
      ((vehRes.data || []) as any[]).forEach((v) => { vehicleLocationMap[v.id] = v.location_id; });

      // Apply client-side filters
      let bookings = ((bRes.data || []) as any[]) as FilteredBooking[];
      bookings = bookings.filter((b) => {
        if (f.vehicleIds.length && (!b.vehicle_id || !f.vehicleIds.includes(b.vehicle_id))) return false;
        if (f.locationIds.length) {
          const loc = b.vehicle_id ? vehicleLocationMap[b.vehicle_id] : null;
          if (!loc || !f.locationIds.includes(loc)) return false;
        }
        if (!sourceMatches(b.booking_source, f.sources)) return false;
        return true;
      });

      // Payments for filtered bookings, restricted to transactions within the window
      const bookingIds = bookings.map((b) => b.id);
      let payments: FilteredPayment[] = [];
      if (bookingIds.length) {
        const { data: payData } = await supabase
          .from("payments")
          .select("id, booking_id, amount, payment_type, payment_status, transaction_date, created_at")
          .in("booking_id", bookingIds)
          .gte("transaction_date", startIso)
          .lte("transaction_date", endIso);
        payments = ((payData || []) as any[]) as FilteredPayment[];
      }

      // Filter expenses by location/vehicle (no source filter for expenses)
      let expenses = ((expRes.data || []) as any[]) as FilteredExpense[];
      expenses = expenses.filter((e) => {
        if (f.vehicleIds.length && (!e.vehicle_id || !f.vehicleIds.includes(e.vehicle_id))) return false;
        if (f.locationIds.length) {
          const loc = e.location_id || (e.vehicle_id ? vehicleLocationMap[e.vehicle_id] : null);
          if (!loc || !f.locationIds.includes(loc)) return false;
        }
        return true;
      });

      // Merge in-window payouts + all-team pending obligations (dedup by id)
      const payoutMap = new Map<string, FilteredPayout>();
      [...((payoutRes.data || []) as any[]), ...((pendingPayoutRes.data || []) as any[])].forEach((p) => {
        payoutMap.set(p.id, p as FilteredPayout);
      });
      let payouts = Array.from(payoutMap.values());
      payouts = payouts.filter((p) => {
        if (f.vehicleIds.length && (!p.vehicle_id || !f.vehicleIds.includes(p.vehicle_id))) return false;
        if (f.locationIds.length) {
          const loc = p.vehicle_id ? vehicleLocationMap[p.vehicle_id] : null;
          if (!loc || !f.locationIds.includes(loc)) return false;
        }
        return true;
      });

      setState({ loading: false, bookings, payments, expenses, payouts, vehicleLocationMap });
    })();
    return () => { cancelled = true; };
  }, [
    currentTeam?.id,
    f.start.getTime(),
    f.end.getTime(),
    f.locationIds.join(","),
    f.vehicleIds.join(","),
    f.sources.join(","),
  ]);

  return state;
}

// Math helpers
export const sumCollected = (payments: FilteredPayment[]) =>
  payments
    .filter((p) => p.payment_type !== "refund" && (p.payment_status === "completed" || p.payment_status === "paid" || p.payment_status == null))
    .reduce((s, p) => s + Number(p.amount || 0), 0);

export const sumRefunds = (payments: FilteredPayment[]) =>
  payments.filter((p) => p.payment_type === "refund").reduce((s, p) => s + Math.abs(Number(p.amount || 0)), 0);

export const sumGross = (bookings: FilteredBooking[]) =>
  bookings.filter((b) => countsForRevenue(b.status)).reduce((s, b) => s + Number(b.total_value || 0), 0);

export const sumPlatformFees = (bookings: FilteredBooking[]) =>
  bookings.filter((b) => countsForRevenue(b.status)).reduce((s, b) => s + Number(b.platform_fee_amount || 0), 0);

export const sumVehicleExpenses = (expenses: FilteredExpense[]) =>
  expenses
    .filter((e) => e.vehicle_id != null)
    .reduce((s, e) => s + Number(e.amount || 0) - Number(e.reimbursed_amount || 0), 0);

export const sumOverhead = (expenses: FilteredExpense[]) =>
  expenses
    .filter((e) => e.vehicle_id == null)
    .reduce((s, e) => s + Number(e.amount || 0) - Number(e.reimbursed_amount || 0), 0);

export const sumPendingPayouts = (payouts: FilteredPayout[]) =>
  payouts.filter((p) => p.status === "pending" || p.status === "scheduled").reduce((s, p) => s + Number(p.net_to_partner || 0), 0);

// All real partner obligations in range (pending + paid), excluding voided — used for net margin
export const sumPartnerPayouts = (payouts: FilteredPayout[]) =>
  payouts.filter((p) => p.status !== "voided" && (p.status as string) !== "cancelled").reduce((s, p) => s + Number(p.net_to_partner || 0), 0);

