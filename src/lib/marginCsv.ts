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

export const formatCurrencyCompact = (n: number | null | undefined, currency?: string) => {
  const active = getActiveMoneyContext();
  const value = Number(n ?? 0);
  const abs = Math.abs(value);
  if (abs < 10000) {
    return formatMoney(value, { currency: currency || active.currency, locale: active.locale, decimals: 0 });
  }
  const sign = value < 0 ? "-" : "";
  const symbol = (() => {
    try {
      const parts = new Intl.NumberFormat(active.locale, { style: "currency", currency: currency || active.currency }).formatToParts(0);
      return parts.find(p => p.type === "currency")?.value ?? "$";
    } catch { return "$"; }
  })();
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
};

export const formatPercent = (n: number | null | undefined) =>
  `${(Number(n ?? 0)).toFixed(1)}%`;
