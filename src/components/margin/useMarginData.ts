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
  status: string | null;
  payment_date: string | null;
  created_at: string;
}

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

      const [vehRes, bRes, expRes, payoutRes] = await Promise.all([
        supabase.from("vehicles").select("id, location_id").eq("team_id", currentTeam.id),
        supabase
          .from("bookings")
          .select("id, vehicle_id, total_value, platform_fee_amount, booking_source, status, start_date, end_date, customer_name, booking_ref")
          .eq("team_id", currentTeam.id)
          .gte("start_date", startIso)
          .lte("start_date", endIso),
        supabase
          .from("vehicle_expenses")
          .select("id, vehicle_id, location_id, expense_type, amount, expense_date, source_module, is_reimbursable, reimbursed_amount")
          .eq("team_id", currentTeam.id)
          .gte("expense_date", startDay)
          .lte("expense_date", endDay),
        supabase
          .from("partner_payouts")
          .select("id, vehicle_id, partner_id, status, net_to_partner, paid_at, created_at")
          .eq("team_id", currentTeam.id)
          .gte("created_at", startIso)
          .lte("created_at", endIso),
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

      // Payments for filtered bookings
      const bookingIds = bookings.map((b) => b.id);
      let payments: FilteredPayment[] = [];
      if (bookingIds.length) {
        const { data: payData } = await supabase
          .from("payments")
          .select("id, booking_id, amount, payment_type, status, payment_date, created_at")
          .in("booking_id", bookingIds);
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

      // Filter payouts by vehicle/location
      let payouts = ((payoutRes.data || []) as any[]) as FilteredPayout[];
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
    .filter((p) => p.payment_type !== "refund" && (p.status === "completed" || p.status === "paid" || p.status === null))
    .reduce((s, p) => s + Number(p.amount || 0), 0);

export const sumRefunds = (payments: FilteredPayment[]) =>
  payments.filter((p) => p.payment_type === "refund").reduce((s, p) => s + Math.abs(Number(p.amount || 0)), 0);

export const sumGross = (bookings: FilteredBooking[]) =>
  bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + Number(b.total_value || 0), 0);

export const sumPlatformFees = (bookings: FilteredBooking[]) =>
  bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + Number(b.platform_fee_amount || 0), 0);

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
