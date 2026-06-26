// CSV export helpers for Margin module
import { formatMoney } from "@/lib/format";
import { getActiveMoneyContext } from "@/lib/utils";

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(c => esc(c.label)).join(",");
  const body = rows.map(r => columns.map(c => esc(r[c.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const formatCurrency = (n: number | null | undefined, currency?: string) => {
  const active = getActiveMoneyContext();
  return formatMoney(n, {
    currency: currency || active.currency,
    locale: active.locale,
    decimals: 2,
  });
};

export const formatPercent = (n: number | null | undefined) =>
  `${(Number(n ?? 0)).toFixed(1)}%`;
