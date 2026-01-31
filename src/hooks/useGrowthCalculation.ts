import { useMemo } from 'react';

interface RecordWithTimestamp {
  created_at?: string | null;
}

/**
 * Calculates period-over-period growth percentage
 * @param records - Array of records with created_at timestamp
 * @param days - Number of days for each period (default: 30)
 * @returns Growth percentage or null if no previous data
 */
export function calculateGrowth<T extends RecordWithTimestamp>(
  records: T[] | null | undefined,
  days: number = 30
): number | null {
  if (!records || records.length === 0) return null;

  const now = new Date();
  const periodEnd = new Date(now);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);
  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - days);

  const current = records.filter(r => {
    if (!r.created_at) return false;
    const date = new Date(r.created_at);
    return date >= periodStart && date < periodEnd;
  }).length;

  const previous = records.filter(r => {
    if (!r.created_at) return false;
    const date = new Date(r.created_at);
    return date >= prevPeriodStart && date < periodStart;
  }).length;

  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Hook for calculating growth percentage
 */
export function useGrowthCalculation<T extends RecordWithTimestamp>(
  records: T[] | null | undefined,
  days: number = 30
): number | null {
  return useMemo(() => calculateGrowth(records, days), [records, days]);
}

/**
 * Calculates revenue growth from records with an amount field
 */
export function calculateRevenueGrowth<T extends RecordWithTimestamp & { total_value?: number | null; amount?: number | null }>(
  records: T[] | null | undefined,
  days: number = 30
): { current: number; previous: number; growth: number | null } {
  if (!records || records.length === 0) {
    return { current: 0, previous: 0, growth: null };
  }

  const now = new Date();
  const periodEnd = new Date(now);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);
  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - days);

  const currentPeriod = records.filter(r => {
    if (!r.created_at) return false;
    const date = new Date(r.created_at);
    return date >= periodStart && date < periodEnd;
  });

  const previousPeriod = records.filter(r => {
    if (!r.created_at) return false;
    const date = new Date(r.created_at);
    return date >= prevPeriodStart && date < periodStart;
  });

  const current = currentPeriod.reduce((sum, r) => sum + (r.total_value || r.amount || 0), 0);
  const previous = previousPeriod.reduce((sum, r) => sum + (r.total_value || r.amount || 0), 0);

  let growth: number | null = null;
  if (previous > 0) {
    growth = Math.round(((current - previous) / previous) * 100);
  } else if (current > 0) {
    growth = 100;
  }

  return { current, previous, growth };
}

/**
 * Hook for calculating revenue growth
 */
export function useRevenueGrowth<T extends RecordWithTimestamp & { total_value?: number | null; amount?: number | null }>(
  records: T[] | null | undefined,
  days: number = 30
) {
  return useMemo(() => calculateRevenueGrowth(records, days), [records, days]);
}
