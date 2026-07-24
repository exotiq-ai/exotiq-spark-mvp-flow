// Unified booking status helpers.
// Covers operator statuses + marketplace lifecycle (M5):
//   requested, pending_documents, pending_payment, declined, refunded.

export const PENDING_STATUSES = [
  'pending',
  'requested',
  'pending_documents',
  'pending_payment',
] as const;

export const CONFIRMED_STATUSES = ['confirmed', 'active'] as const;

export const CANCELLED_STATUSES = ['cancelled', 'declined', 'refunded', 'payment_expired'] as const;

/** Statuses that block a vehicle's calendar/availability. Mirrors the DB
 *  exclusion predicate on bookings_no_marketplace_overlap. */
export const BLOCKING_STATUSES = [
  'requested',
  'pending_documents',
  'pending_payment',
  'pending',
  'confirmed',
  'active',
] as const;

/** Tailwind classes for the status badge. */
export function getBookingStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'confirmed':
    case 'active':
      return 'bg-success/10 text-success border-success/30';
    case 'completed':
      return 'bg-primary/10 text-primary border-primary/30';
    case 'cancelled':
    case 'declined':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'refunded':
    case 'payment_expired':
      return 'bg-muted/40 text-muted-foreground border-muted-foreground/30';
    case 'pending':
    case 'requested':
    case 'pending_documents':
    case 'pending_payment':
      return 'bg-warning/10 text-warning border-warning/30';
    default:
      return 'bg-muted/10 text-muted-foreground border-muted/20';
  }
}

/** Human-friendly label. Marketplace statuses get renter-facing copy. */
export function getBookingStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'requested':
      return 'Requested';
    case 'pending_documents':
      return 'Awaiting Docs';
    case 'pending_payment':
      return 'Awaiting Payment';
    case 'declined':
      return 'Declined';
    case 'refunded':
      return 'Refunded';
    case 'payment_expired':
      return 'Payment window expired';
    case 'pending':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status ?? 'Unknown';
  }
}

export function isPendingStatus(status: string | null | undefined): boolean {
  return (PENDING_STATUSES as readonly string[]).includes(status ?? '');
}

export function isConfirmedStatus(status: string | null | undefined): boolean {
  return (CONFIRMED_STATUSES as readonly string[]).includes(status ?? '');
}

export function isCancelledStatus(status: string | null | undefined): boolean {
  return (CANCELLED_STATUSES as readonly string[]).includes(status ?? '');
}

export function isBlockingStatus(status: string | null | undefined): boolean {
  return (BLOCKING_STATUSES as readonly string[]).includes(status ?? '');
}
