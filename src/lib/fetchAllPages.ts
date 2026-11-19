/**
 * Reads every row of a query, a page at a time. Supabase (PostgREST) returns at most 1,000 rows per request
 * however large `.limit()` is, so a single request silently drops everything past the first 1,000 rows.
 *
 * `fetchPage(from, to)` must run the same query with `.range(from, to)` and a stable order (end the order
 * with a unique column such as `id`), or rows can repeat or go missing between pages.
 */
export const PAGE_SIZE = 1000;

type Page<T> = { data: T[] | null; error: unknown };

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  { pageSize = PAGE_SIZE, maxRows = 50_000 }: { pageSize?: number; maxRows?: number } = {},
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  while (rows.length < maxRows) {
    const from = rows.length;
    const to = Math.min(from + pageSize, maxRows) - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) return { data: rows, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < to - from + 1) break;
  }
  return { data: rows, error: null };
}
