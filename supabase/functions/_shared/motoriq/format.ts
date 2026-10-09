/** Plain-language date helpers shared by the insights, the recommendations and the screens (UTC calendar days). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parts = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1, day: Number(d.slice(8, 10)) });

/** "Oct 16" */
export const niceDay = (d: string) => {
  const p = parts(d);
  return `${MONTHS[p.m] ?? "?"} ${p.day}`;
};

/** "Oct 16" for a single day, "Oct 16 to 18" within a month, "Oct 30 to Nov 2" across months. */
export function niceRange(from: string, to: string): string {
  if (from === to) return niceDay(from);
  const a = parts(from);
  const b = parts(to);
  return a.m === b.m && a.y === b.y ? `${niceDay(from)} to ${b.day}` : `${niceDay(from)} to ${niceDay(to)}`;
}
