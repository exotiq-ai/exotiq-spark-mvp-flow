import { Database } from '@/integrations/supabase/types';

type Booking = Database['public']['Tables']['bookings']['Row'];
type Maintenance = Database['public']['Tables']['maintenance_schedules']['Row'];

/**
 * Determines if a booking status should block vehicle availability.
 * Only `pending` and `confirmed` bookings block — `cancelled` and `completed` do not.
 */
export const isBlockingBooking = (status: string | null): boolean =>
  status !== 'cancelled' && status !== 'completed';

/**
 * Returns true if any blocking booking for the given vehicle overlaps [start, end)
 * using the half-open predicate: start < bEnd && end > bStart.
 * Optionally excludes a booking by id (for edit flows).
 */
export const hasBlockingOverlap = (
  vehicleId: string,
  start: Date,
  end: Date,
  bookings: { vehicle_id: string; status: string | null; start_date: string; end_date: string }[],
  excludeBookingId?: string
): boolean =>
  bookings.some((b) => {
    if (b.vehicle_id !== vehicleId) return false;
    if (!isBlockingBooking(b.status)) return false;
    if (excludeBookingId && (b as { id?: string }).id === excludeBookingId) return false;
    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);
    return start < bEnd && end > bStart;
  });

// ─── Vehicle availability (single source of truth) ──────────────────────────
// Combines vehicle status, active out-of-service work orders, and blocking
// bookings into one answer used by pickers, cards, and the calendar.

const ACTIVE_WO_STATUSES = new Set([
  'new', 'triaged', 'scheduled', 'in_progress',
  'blocked_parts', 'blocked_vendor', 'qa_review',
]);

export interface VehicleAvailabilityInput {
  vehicle: { id: string; status: string | null };
  window: { start: Date; end: Date };
  bookings: { id?: string; vehicle_id: string; status: string | null; start_date: string; end_date: string }[];
  workOrders: {
    id: string;
    vehicle_id: string;
    status: string;
    out_of_rotation: boolean;
    expected_return_at: string | null;
  }[];
  excludeBookingId?: string;
}

export type UnavailableReason =
  | 'retired'
  | 'maintenance_status'
  | 'out_of_service'
  | 'booking';

export interface VehicleAvailabilityState {
  available: boolean;
  reason: UnavailableReason | null;
  label: string | null;              // short user-facing label e.g. "Out of service"
  detail: string | null;             // extra info e.g. "returns Mar 12"
  workOrderId?: string;
  bookingId?: string;
  expectedReturnAt?: string | null;
}

/**
 * Returns whether the given active work order blocks the requested window.
 * If expected_return_at is null, the block is treated as indefinite.
 */
export const workOrderBlocks = (
  wo: { status: string; out_of_rotation: boolean; expected_return_at: string | null },
  start: Date,
  end: Date
): boolean => {
  if (!wo.out_of_rotation) return false;
  if (!ACTIVE_WO_STATUSES.has(wo.status)) return false;
  if (!wo.expected_return_at) return true; // indefinite → always blocks
  const until = new Date(wo.expected_return_at);
  // Block if the requested window starts before the vehicle is expected back.
  return start < until;
};

const shortDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export const getVehicleAvailabilityState = ({
  vehicle,
  window,
  bookings,
  workOrders,
  excludeBookingId,
}: VehicleAvailabilityInput): VehicleAvailabilityState => {
  if (vehicle.status === 'retired') {
    return { available: false, reason: 'retired', label: 'Retired', detail: null };
  }

  // Active OOR work order overlapping window
  const blockingWO = workOrders.find(
    (w) => w.vehicle_id === vehicle.id && workOrderBlocks(w, window.start, window.end)
  );
  if (blockingWO) {
    return {
      available: false,
      reason: 'out_of_service',
      label: 'Out of service',
      detail: blockingWO.expected_return_at
        ? `returns ${shortDate(blockingWO.expected_return_at)}`
        : 'no return date set',
      workOrderId: blockingWO.id,
      expectedReturnAt: blockingWO.expected_return_at,
    };
  }

  // Vehicle marked in maintenance manually and no scheduled return date
  if (vehicle.status === 'maintenance') {
    return {
      available: false,
      reason: 'maintenance_status',
      label: 'In maintenance',
      detail: null,
    };
  }

  // Booking overlap
  const overlap = bookings.find((b) => {
    if (b.vehicle_id !== vehicle.id) return false;
    if (!isBlockingBooking(b.status)) return false;
    if (excludeBookingId && b.id === excludeBookingId) return false;
    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);
    return window.start < bEnd && window.end > bStart;
  });
  if (overlap) {
    return {
      available: false,
      reason: 'booking',
      label: 'Booked',
      detail: null,
      bookingId: overlap.id,
    };
  }

  return { available: true, reason: null, label: null, detail: null };
};

/** Convenience: does the vehicle have any active out-of-service work order right now? */
export const getActiveOutOfServiceWorkOrder = <
  T extends { vehicle_id: string; status: string; out_of_rotation: boolean; expected_return_at: string | null }
>(
  vehicleId: string,
  workOrders: T[]
): T | undefined =>
  workOrders.find(
    (w) =>
      w.vehicle_id === vehicleId &&
      w.out_of_rotation &&
      ACTIVE_WO_STATUSES.has(w.status)
  );

export interface Conflict {
  type: 'overlap' | 'buffer' | 'maintenance' | 'availability';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  bookingIds?: string[];
  suggestion?: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: Conflict[];
  suggestions: string[];
}

const BUFFER_TIME_HOURS = 4; // 4 hours between rentals for cleaning/inspection

export const checkBookingConflicts = (
  newBooking: {
    vehicle_id: string;
    start_date: string;
    end_date: string;
    id?: string;
  },
  existingBookings: Booking[],
  maintenanceSchedules: Maintenance[]
): ConflictCheckResult => {
  const conflicts: Conflict[] = [];
  const suggestions: string[] = [];

  const newStart = new Date(newBooking.start_date);
  const newEnd = new Date(newBooking.end_date);

  // Filter bookings for the same vehicle (excluding the current booking if editing)
  const relevantBookings = existingBookings.filter(
    (b) => 
      b.vehicle_id === newBooking.vehicle_id && 
      isBlockingBooking(b.status) &&
      b.id !== newBooking.id
  );

  // Check for overlapping bookings
  relevantBookings.forEach((booking) => {
    const existingStart = new Date(booking.start_date);
    const existingEnd = new Date(booking.end_date);

    // Check for direct overlap
    if (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    ) {
      conflicts.push({
        type: 'overlap',
        severity: 'critical',
        message: `Overlaps with existing booking from ${existingStart.toLocaleDateString()} to ${existingEnd.toLocaleDateString()}`,
        bookingIds: [booking.id],
        suggestion: 'Choose different dates or vehicle'
      });
    }

    // Check for insufficient buffer time
    const timeDiffStart = Math.abs(newStart.getTime() - existingEnd.getTime());
    const timeDiffEnd = Math.abs(existingStart.getTime() - newEnd.getTime());
    const bufferTimeMs = BUFFER_TIME_HOURS * 60 * 60 * 1000;

    if (timeDiffStart < bufferTimeMs && newStart > existingEnd) {
      const hoursGap = Math.floor(timeDiffStart / (60 * 60 * 1000));
      conflicts.push({
        type: 'buffer',
        severity: 'warning',
        message: `Only ${hoursGap} hours between bookings (recommended: ${BUFFER_TIME_HOURS} hours for cleaning)`,
        bookingIds: [booking.id],
        suggestion: `Add ${BUFFER_TIME_HOURS - hoursGap} more hours buffer time`
      });
    }

    if (timeDiffEnd < bufferTimeMs && existingStart > newEnd) {
      const hoursGap = Math.floor(timeDiffEnd / (60 * 60 * 1000));
      conflicts.push({
        type: 'buffer',
        severity: 'warning',
        message: `Only ${hoursGap} hours between bookings (recommended: ${BUFFER_TIME_HOURS} hours for cleaning)`,
        bookingIds: [booking.id],
        suggestion: `Add ${BUFFER_TIME_HOURS - hoursGap} more hours buffer time`
      });
    }
  });

  // Check for maintenance schedule conflicts
  const relevantMaintenance = maintenanceSchedules.filter(
    (m) => m.vehicle_id === newBooking.vehicle_id && m.status !== 'completed'
  );

  relevantMaintenance.forEach((maintenance) => {
    const maintenanceDate = new Date(maintenance.scheduled_date);
    
    if (maintenanceDate >= newStart && maintenanceDate <= newEnd) {
      conflicts.push({
        type: 'maintenance',
        severity: 'critical',
        message: `Maintenance scheduled on ${maintenanceDate.toLocaleDateString()} - ${maintenance.maintenance_type}`,
        suggestion: 'Reschedule booking or maintenance'
      });
    }
  });

  // Generate suggestions based on conflicts
  if (conflicts.length > 0) {
    const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
    if (criticalConflicts.length > 0) {
      suggestions.push('Consider selecting a different vehicle or date range');
    }

    const bufferConflicts = conflicts.filter(c => c.type === 'buffer');
    if (bufferConflicts.length > 0) {
      suggestions.push('Add buffer time between bookings for vehicle preparation');
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    suggestions
  };
};

export const generateVehicleColors = (vehicleIds: string[]): Record<string, string> => {
  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--success))',
    'hsl(var(--accent))',
    'hsl(var(--warning))',
    'hsl(142, 76%, 36%)', // Green
    'hsl(221, 83%, 53%)', // Blue
    'hsl(262, 83%, 58%)', // Purple
    'hsl(346, 77%, 50%)', // Red-Pink
  ];

  const colorMap: Record<string, string> = {};
  vehicleIds.forEach((id, index) => {
    colorMap[id] = colors[index % colors.length];
  });

  return colorMap;
};
