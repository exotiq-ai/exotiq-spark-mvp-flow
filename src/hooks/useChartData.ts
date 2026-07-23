import { useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';

type Booking = Tables<'bookings'>;
type Payment = Tables<'payments'>;

export type ChartRange = '7D' | '30D' | 'MTD' | 'QTD' | 'YTD';

export interface RevenuePoint {
  date: string;
  fullDate: string;
  revenue: number;
  movingAvg: number;
  previousRevenue: number;
  bookingsCount: number;
  bookings: Booking[];
  isWeekend: boolean;
}

const toLocalDateStr = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const daysBetween = (start: Date, end: Date) =>
  Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1);

const rangeBounds = (range: ChartRange): { start: Date; end: Date } => {
  const end = startOfDay(new Date());
  const start = new Date(end);
  switch (range) {
    case '7D':
      start.setDate(end.getDate() - 6);
      break;
    case '30D':
      start.setDate(end.getDate() - 29);
      break;
    case 'MTD':
      start.setDate(1);
      break;
    case 'QTD': {
      const qStartMonth = Math.floor(end.getMonth() / 3) * 3;
      start.setMonth(qStartMonth, 1);
      break;
    }
    case 'YTD':
      start.setMonth(0, 1);
      break;
  }
  return { start, end };
};

export const getRangeBounds = rangeBounds;

const buildSeries = (
  start: Date,
  end: Date,
  valueForDay: (dateStr: string, day: Date) => { revenue: number; bookingsCount: number; bookings: Booking[] },
) => {
  const out: Omit<RevenuePoint, 'movingAvg' | 'previousRevenue'>[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = toLocalDateStr(cursor);
    const { revenue, bookingsCount, bookings } = valueForDay(dateStr, cursor);
    out.push({
      date: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: dateStr,
      revenue,
      bookingsCount,
      bookings,
      isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

const withMovingAverage = <T extends { revenue: number }>(series: T[], window = 7): (T & { movingAvg: number })[] => {
  return series.map((p, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = series.slice(from, i + 1);
    const avg = slice.reduce((s, x) => s + x.revenue, 0) / slice.length;
    return { ...p, movingAvg: avg };
  });
};

export const useChartData = (bookings: Booking[], payments: Payment[], range: ChartRange = '30D') => {
  const { revenueData, collectedData } = useMemo(() => {
    const { start, end } = rangeBounds(range);
    const spanDays = daysBetween(start, end);
    const priorEnd = new Date(start);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorEnd.getDate() - (spanDays - 1));

    // Booked revenue: bookings whose start_date falls on the day
    const bookedFor = (dateStr: string) => {
      const dayBookings = bookings.filter((b) => {
        const startDate = new Date(b.start_date);
        return (
          toLocalDateStr(startDate) === dateStr &&
          (b.status === 'confirmed' || b.status === 'completed')
        );
      });
      return {
        revenue: dayBookings.reduce((s, b) => s + (b.total_value || 0), 0),
        bookingsCount: dayBookings.length,
        bookings: dayBookings,
      };
    };

    // Collected: payment transactions on the day
    const collectedFor = (dateStr: string) => {
      const dayPayments = payments.filter((p) => {
        if (!p.transaction_date) return false;
        return toLocalDateStr(new Date(p.transaction_date)) === dateStr;
      });
      return {
        revenue: dayPayments.reduce((s, p) => s + p.amount, 0),
        bookingsCount: dayPayments.length,
        bookings: [] as Booking[],
      };
    };

    const bookedCurrent = buildSeries(start, end, bookedFor);
    const bookedPrior = buildSeries(priorStart, priorEnd, bookedFor);
    const collectedCurrent = buildSeries(start, end, collectedFor);
    const collectedPrior = buildSeries(priorStart, priorEnd, collectedFor);

    const attachPrior = <T extends { revenue: number }>(
      current: T[],
      prior: { revenue: number }[],
    ): (T & { previousRevenue: number })[] =>
      current.map((p, i) => ({ ...p, previousRevenue: prior[i]?.revenue ?? 0 }));

    const revenueData = withMovingAverage(attachPrior(bookedCurrent, bookedPrior)) as RevenuePoint[];
    const collectedData = withMovingAverage(attachPrior(collectedCurrent, collectedPrior)) as RevenuePoint[];
    return { revenueData, collectedData };
  }, [bookings, payments, range]);

  return { revenueData, collectedData };
};
