import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages } from '@/lib/fetchAllPages';

// A stand-in for a Supabase query: returns rows [from, to] of `total`, capped like PostgREST's max-rows.
const table = (total: number, serverCap = 1000) =>
  vi.fn(async (from: number, to: number) => {
    const end = Math.min(to, from + serverCap - 1, total - 1);
    const data = end < from ? [] : Array.from({ length: end - from + 1 }, (_, i) => ({ n: from + i }));
    return { data, error: null };
  });

describe('fetchAllPages', () => {
  it('returns every row when the table is larger than one page', async () => {
    const page = table(2369);
    const { data, error } = await fetchAllPages(page);
    expect(error).toBeNull();
    expect(data).toHaveLength(2369);
    expect(data[0]).toEqual({ n: 0 });
    expect(data[2368]).toEqual({ n: 2368 });
    expect(page).toHaveBeenCalledTimes(3);
    expect(page).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('makes one request when everything fits in a page', async () => {
    const page = table(17);
    const { data } = await fetchAllPages(page);
    expect(data).toHaveLength(17);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('asks for one more page when the last page is exactly full', async () => {
    const page = table(2000);
    const { data } = await fetchAllPages(page);
    expect(data).toHaveLength(2000);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it('stops at maxRows', async () => {
    const page = table(9000);
    const { data } = await fetchAllPages(page, { maxRows: 5000 });
    expect(data).toHaveLength(5000);
    expect(page).toHaveBeenLastCalledWith(4000, 4999);
  });

  it('returns the error and stops when a page fails', async () => {
    const failure = { message: 'boom', code: '500' };
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, n) => ({ n })), error: null })
      .mockResolvedValueOnce({ data: null, error: failure });
    const { data, error } = await fetchAllPages(page);
    expect(error).toBe(failure);
    expect(data).toHaveLength(1000);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('treats a page with no data as the end', async () => {
    const page = vi.fn().mockResolvedValueOnce({ data: null, error: null });
    const { data, error } = await fetchAllPages(page);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
