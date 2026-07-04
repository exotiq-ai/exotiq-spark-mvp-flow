import { useMemo } from 'react';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { useFleetTasks, type VehicleTask } from '@/hooks/useFleetTasks';
import { useFleetAIInsight } from '@/hooks/useFleetAIInsight';
import { useUserRole, type AppRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import {
  isOnRentStatus,
  onRentVehicleIdsAt,
  pickupsOnDay,
  returnsOnDay,
  sumBookedForPickupsOn,
  sumCollectedOnDay,
} from '@/lib/fleetMetrics';

/**
 * useDailyBrief — deterministic "what's happening in my fleet today" facts.
 *
 * Numbers are computed locally from already-loaded fleet/task data so they are
 * exact, free, and instant (they must match Pulse/Bookings). The AI narrative
 * layer (daily-brief-narrative edge fn) only ever rephrases these facts; it
 * never produces figures of its own.
 */

export type IssueSeverity = 'high' | 'medium' | 'low';

export type IssueCategory =
  | 'booking'
  | 'payment'
  | 'task'
  | 'maintenance'
  | 'damage'
  | 'pricing';

export interface DailyBriefIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  detail?: string;
  /** Module id for click-through via onModuleClick (e.g. 'book', 'fleet'). */
  module?: string;
  /** Ids for deep-link / one-tap actions in the UI. */
  meta?: Record<string, string | number | null | undefined>;
}

export interface DailyBriefMetric {
  key: string;
  label: string;
  count: number;
  amount?: number;
  module?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export interface DailyBriefFacts {
  greetingName: string;
  companyName?: string;
  dateLabel: string;
  role: AppRole | null;

  // Operational punch-list counts (today)
  onRent: number;
  pickupsToday: number;
  returnsToday: number;
  overdueReturns: number;
  newBookings24h: number;
  pendingConfirmations: number;
  openTasks: number;
  overdueTasks: number;
  utilization: number;

  // Money — separated so callers never conflate "booked" (leading) with "collected" (cash)
  bookedToday: number;
  collectedToday: number;
  outstandingBalance: number;

  // Ranked attention list + headline metrics
  issues: DailyBriefIssue[];
  metrics: DailyBriefMetric[];

  loading: boolean;
  /** True when nothing needs attention — drives the "All clear" empty state. */
  isClear: boolean;
}

/** Minimal shapes this hook reads (fleet context types are intentionally loose). */
interface BriefBooking {
  id: string;
  status: string | null;
  start_date: string;
  end_date: string;
  total_value: number | null;
  balance_due: number | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  customer_name: string;
  created_at: string | null;
}

interface BriefVehicle {
  id: string;
  name: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
}

interface BriefDamageClaim {
  id: string;
  claim_status: string | null;
}

interface BriefMaintenance {
  id: string;
  status: string | null;
}

const SEVERITY_RANK: Record<IssueSeverity, number> = { high: 3, medium: 2, low: 1 };

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

export const useDailyBrief = (): DailyBriefFacts => {
  const fleet = useLocationFilteredFleet();
  const { tasks, loading: tasksLoading } = useFleetTasks();
  const { role } = useUserRole();
  const { profile } = useProfile();
  const aiInsight = useFleetAIInsight(fleet.vehicles, fleet.bookings);

  const bookings = fleet.bookings as unknown as BriefBooking[];
  const vehicles = fleet.vehicles as unknown as BriefVehicle[];
  const payments = (fleet as unknown as { payments?: Array<{ transaction_date?: string | null; amount?: number | null }> }).payments || [];
  const damageClaims = fleet.damageClaims as unknown as BriefDamageClaim[];
  const maintenance = fleet.maintenance as unknown as BriefMaintenance[];
  const openTasksList: VehicleTask[] = tasks;
  const fleetLoading = fleet.loading;

  const vehicleLabel = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((v) => {
      map.set(v.id, v.name || [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle');
    });
    return (booking: BriefBooking) =>
      booking.vehicle_name || (booking.vehicle_id ? map.get(booking.vehicle_id) : undefined) || 'Vehicle';
  }, [vehicles]);

  return useMemo<DailyBriefFacts>(() => {
    const now = new Date();
    const today = startOfDay(now);

    // Vehicles on rent right now — shared helper (confirmed | active)
    const onRentVehicleIds = onRentVehicleIdsAt(bookings, now);

    const pickupsTodayList = pickupsOnDay(bookings, today);
    const returnsTodayList = returnsOnDay(bookings, today);

    const overdueReturnList = bookings.filter(
      (b) => isOnRentStatus(b.status) && new Date(b.end_date) < today,
    );

    const newBookings24hList = bookings.filter((b) => {
      if (!b.created_at) return false;
      return now.getTime() - new Date(b.created_at).getTime() <= 24 * 60 * 60 * 1000;
    });

    const pendingConfirmationList = bookings.filter((b) => b.status === 'pending');

    const outstandingList = bookings.filter(
      (b) => b.status !== 'cancelled' && num(b.balance_due) > 0,
    );
    const outstandingBalance = outstandingList.reduce((sum, b) => sum + num(b.balance_due), 0);

    const bookedToday = sumBookedForPickupsOn(bookings, today);
    const collectedToday = sumCollectedOnDay(payments, today);

    const vehicleCount = vehicles.length;
    const utilization = vehicleCount > 0 ? Math.round((onRentVehicleIds.size / vehicleCount) * 100) : 0;

    // Tasks
    const openTaskList = openTasksList.filter(
      (t) => t.status === 'pending' || t.status === 'in_progress',
    );
    const overdueTaskList = openTaskList.filter((t) => t.due_at && new Date(t.due_at) < now);
    const urgentOpenTasks = openTaskList.filter((t) => t.priority === 'urgent');

    // Damage + maintenance
    const openDamageList = damageClaims.filter((c) => c.claim_status === 'open');
    const scheduledMaintenance = maintenance.filter(
      (m) => m.status === 'scheduled' || m.status === 'in_progress',
    );

    // ---- Ranked attention list ----
    const issues: DailyBriefIssue[] = [];

    if (overdueReturnList.length > 0) {
      const n = overdueReturnList.length;
      issues.push({
        id: 'overdue-returns',
        severity: 'high',
        category: 'booking',
        title: `${n} ${n === 1 ? 'return' : 'returns'} overdue`,
        detail: overdueReturnList
          .slice(0, 3)
          .map((b) => `${vehicleLabel(b)} (${b.customer_name})`)
          .join(', '),
        module: 'book',
        meta: { bookingId: overdueReturnList[0]?.id },
      });
    }

    if (overdueTaskList.length > 0) {
      const n = overdueTaskList.length;
      issues.push({
        id: 'overdue-tasks',
        severity: 'high',
        category: 'task',
        title: `${n} ${n === 1 ? 'task' : 'tasks'} overdue`,
        detail: overdueTaskList.slice(0, 3).map((t) => t.title).join(', '),
        module: 'fleet',
        meta: { taskId: overdueTaskList[0]?.id },
      });
    }

    if (outstandingList.length > 0) {
      const n = outstandingList.length;
      issues.push({
        id: 'outstanding-balance',
        severity: 'high',
        category: 'payment',
        title: `${n} ${n === 1 ? 'balance' : 'balances'} outstanding · $${Math.round(outstandingBalance).toLocaleString()}`,
        module: 'book',
        meta: { bookingId: outstandingList[0]?.id, amount: Math.round(outstandingBalance) },
      });
    }

    if (pendingConfirmationList.length > 0) {
      const n = pendingConfirmationList.length;
      issues.push({
        id: 'pending-confirmations',
        severity: 'medium',
        category: 'booking',
        title: `${n} ${n === 1 ? 'booking needs' : 'bookings need'} confirming`,
        detail: pendingConfirmationList
          .slice(0, 3)
          .map((b) => `${vehicleLabel(b)} (${b.customer_name})`)
          .join(', '),
        module: 'book',
        meta: { bookingId: pendingConfirmationList[0]?.id },
      });
    }

    if (urgentOpenTasks.length > 0) {
      const n = urgentOpenTasks.length;
      issues.push({
        id: 'urgent-tasks',
        severity: 'medium',
        category: 'task',
        title: `${n} urgent ${n === 1 ? 'task' : 'tasks'}`,
        detail: urgentOpenTasks.slice(0, 3).map((t) => t.title).join(', '),
        module: 'fleet',
        meta: { taskId: urgentOpenTasks[0]?.id },
      });
    }

    if (openDamageList.length > 0) {
      const n = openDamageList.length;
      issues.push({
        id: 'open-damage',
        severity: 'medium',
        category: 'damage',
        title: `${n} open damage ${n === 1 ? 'claim' : 'claims'}`,
        module: 'vault',
        meta: { damageClaimId: openDamageList[0]?.id },
      });
    }

    if (scheduledMaintenance.length > 0) {
      const n = scheduledMaintenance.length;
      issues.push({
        id: 'maintenance',
        severity: 'low',
        category: 'maintenance',
        title: `${n} ${n === 1 ? 'vehicle' : 'vehicles'} in service`,
        module: 'fleet',
      });
    }

    if (aiInsight) {
      issues.push({
        id: 'pricing-opportunity',
        severity: 'low',
        category: 'pricing',
        title: `Raise ${aiInsight.vehicleName} rate ${aiInsight.suggestedIncreasePercent}% · ~$${aiInsight.potentialMonthlyRevenue.toLocaleString()}/mo`,
        module: 'motoriq',
        meta: { vehicleId: aiInsight.vehicleId },
      });
    }


    issues.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

    const metrics: DailyBriefMetric[] = [
      { key: 'onRent', label: 'On rent now', count: onRentVehicleIds.size, module: 'fleet', tone: 'default' },
      { key: 'pickupsToday', label: 'Going out today', count: pickupsTodayList.length, amount: bookedToday, module: 'book', tone: 'success' },
      { key: 'returnsToday', label: 'Coming in today', count: returnsTodayList.length, module: 'book', tone: 'default' },
      { key: 'newBookings', label: 'New (24h)', count: newBookings24hList.length, module: 'book', tone: 'success' },
      { key: 'openTasks', label: 'Open tasks', count: openTaskList.length, module: 'fleet', tone: overdueTaskList.length > 0 ? 'warning' : 'default' },
      { key: 'utilization', label: 'Utilization', count: utilization, module: 'pulse', tone: 'default' },
    ];

    const fleetReady = !fleetLoading && !tasksLoading;

    return {
      greetingName: profile?.full_name?.split(' ')[0] || 'there',
      companyName: profile?.company_name || undefined,
      dateLabel: now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      role,

      onRent: onRentVehicleIds.size,
      pickupsToday: pickupsTodayList.length,
      returnsToday: returnsTodayList.length,
      overdueReturns: overdueReturnList.length,
      newBookings24h: newBookings24hList.length,
      pendingConfirmations: pendingConfirmationList.length,
      openTasks: openTaskList.length,
      overdueTasks: overdueTaskList.length,
      utilization,

      bookedToday,
      collectedToday,
      outstandingBalance,

      issues,
      metrics,

      loading: !fleetReady,
      isClear: fleetReady && issues.length === 0,
    };
  }, [
    bookings,
    vehicles,
    damageClaims,
    maintenance,
    openTasksList,
    role,
    profile,
    aiInsight,
    fleetLoading,
    tasksLoading,
    vehicleLabel,
  ]);
};
