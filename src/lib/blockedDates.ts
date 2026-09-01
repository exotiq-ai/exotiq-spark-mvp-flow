// Manual vehicle date blocks (e.g. the car is out on Turo, on a photoshoot,
// or in transport). These are NOT bookings — they never appear in revenue,
// CRM, or utilization. They only make a vehicle unavailable for a window.

export type BlockReason =
  | 'turo'
  | 'other_platform'
  | 'personal_use'
  | 'transport'
  | 'detailing'
  | 'other';

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  turo: 'Rented on Turo',
  other_platform: 'Rented on another platform',
  personal_use: 'Personal / owner use',
  transport: 'In transport',
  detailing: 'Detailing / prep',
  other: 'Unavailable',
};

export const BLOCK_REASON_OPTIONS: { value: BlockReason; label: string }[] =
  (Object.keys(BLOCK_REASON_LABELS) as BlockReason[]).map((value) => ({
    value,
    label: BLOCK_REASON_LABELS[value],
  }));

export const blockReasonLabel = (reason: string | null | undefined): string =>
  BLOCK_REASON_LABELS[(reason || 'other') as BlockReason] ?? BLOCK_REASON_LABELS.other;

export interface VehicleBlockedDate {
  id: string;
  team_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  source: string;
  note: string | null;
  created_at?: string;
}
