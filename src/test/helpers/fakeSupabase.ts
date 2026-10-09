// A tiny in-memory stand-in for the parts of supabase-js the Rari tools use (select/filter/order/limit/range/embed).
// ---------------------------------------------------------------------------------------------------------------
export type Row = Record<string, any>;

class Query implements PromiseLike<{ data: any; error: any }> {
  private filters: Array<(r: Row) => boolean> = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private lim: number | null = null;
  private rng: [number, number] | null = null;
  private embed: string[] = [];
  private single: "maybe" | "one" | null = null;
  constructor(private rows: Row[], private all: Record<string, Row[]>) {}

  select(cols?: string) {
    for (const m of String(cols ?? "").matchAll(/(\w+)\(([^)]*)\)/g)) this.embed.push(m[1]);
    return this;
  }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && String(r[c]) >= String(v)); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] != null && String(r[c]) <= String(v)); return this; }
  lt(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] < v); return this; }
  not(c: string, op: string, v: any) {
    if (op === "in") { const set = String(v).replace(/[()"]/g, "").split(","); this.filters.push((r) => !set.includes(String(r[c]))); }
    return this;
  }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  ilike(c: string, p: string) { const needle = p.replace(/%/g, "").toLowerCase(); this.filters.push((r) => String(r[c] ?? "").toLowerCase().includes(needle)); return this; }
  or(expr: string) {
    const parts = expr.split(",").map((e) => e.match(/^(\w+)\.ilike\.%(.*)%$/)).filter(Boolean) as RegExpMatchArray[];
    this.filters.push((r) => parts.length === 0 || parts.some((m) => String(r[m[1]] ?? "").toLowerCase().includes(m[2].toLowerCase())));
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) { this.orderBy = { col: c, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.rng = [a, b]; return this; }
  maybeSingle() { this.single = "maybe"; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then<T1, T2>(ok?: any, bad?: any): PromiseLike<T1 | T2> { return Promise.resolve(this.run()).then(ok, bad); }

  private run() {
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : 1) * (asc ? 1 : -1));
    }
    if (this.rng) out = out.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim != null) out = out.slice(0, this.lim);
    if (this.embed.includes("vehicles")) out = out.map((r) => ({ ...r, vehicles: (this.all.vehicles ?? []).find((v) => v.id === r.vehicle_id) ?? null }));
    if (this.single) return { data: out[0] ?? null, error: null };
    return { data: out, error: null };
  }
}

export const fakeDb = (tables: Record<string, Row[]>) => ({ from: (t: string) => new Query(tables[t] ?? [], tables) }) as any;

