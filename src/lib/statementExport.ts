// Per-partner statement CSV export, built on the shared statement aggregator.
import { toCsv, downloadCsv, formatCurrency } from "./marginCsv";
import type { PartnerStatement, StatementPayout } from "./partnerStatement";

export interface StatementExportContext {
  partnerName: string;
  vehicleName: (id: string) => string;
  bookingRef: (id: string) => string;
}

interface RowLike extends StatementPayout {
  partner_id?: string;
  vehicle_id?: string;
  booking_id?: string;
}

export function buildStatementCsv(
  statement: PartnerStatement,
  rows: RowLike[],
  ctx: StatementExportContext
): string {
  const all = [...statement.paid, ...statement.pending, ...statement.voided];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const dataRows = all.map((p) => {
    const src = byId.get(p.id) || ({} as RowLike);
    return {
      created_at: new Date(p.created_at).toLocaleDateString(),
      vehicle: src.vehicle_id ? ctx.vehicleName(src.vehicle_id) : "",
      booking: src.booking_id ? ctx.bookingRef(src.booking_id) : "",
      gross_rental_base: formatCurrency(p.gross_rental_base),
      platform_fee_amount: formatCurrency(p.platform_fee_amount),
      net_after_fee: formatCurrency(p.net_after_fee),
      net_to_partner: formatCurrency(p.net_to_partner),
      status: p.status,
      paid_at: p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "",
    };
  });

  // Totals row
  dataRows.push({
    created_at: "TOTALS",
    vehicle: "",
    booking: "",
    gross_rental_base: formatCurrency(statement.totals.grossBase),
    platform_fee_amount: formatCurrency(statement.totals.platformFees),
    net_after_fee: "",
    net_to_partner: formatCurrency(statement.totals.lifetimePaid + statement.totals.outstanding),
    status: `paid ${formatCurrency(statement.totals.lifetimePaid)} / outstanding ${formatCurrency(statement.totals.outstanding)}`,
    paid_at: "",
  });

  return toCsv(dataRows as any, [
    { key: "created_at", label: "Date" },
    { key: "vehicle", label: "Vehicle" },
    { key: "booking", label: "Booking" },
    { key: "gross_rental_base", label: "Gross Base" },
    { key: "platform_fee_amount", label: "Platform Fee" },
    { key: "net_after_fee", label: "Net After Fee" },
    { key: "net_to_partner", label: "To Partner" },
    { key: "status", label: "Status" },
    { key: "paid_at", label: "Paid On" },
  ]);
}

export function downloadStatementCsv(
  statement: PartnerStatement,
  rows: RowLike[],
  ctx: StatementExportContext
) {
  const csv = buildStatementCsv(statement, rows, ctx);
  const safe = ctx.partnerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  downloadCsv(`statement-${safe}-${Date.now()}.csv`, csv);
}

export interface PrintStatementContext extends StatementExportContext {
  operatorName?: string;
  operatorLogoUrl?: string | null;
  rangeLabel?: string;
}

// Renders a print-friendly HTML statement and opens the browser print dialog.
// Users get a clean PDF via "Save as PDF" — no extra dependencies.
export function printPartnerStatement(
  statement: PartnerStatement,
  rows: RowLike[],
  ctx: PrintStatementContext
) {
  const all = [...statement.paid, ...statement.pending, ...statement.voided];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const rowHtml = all.length
    ? all
        .map((p) => {
          const src = byId.get(p.id) || ({} as RowLike);
          const veh = src.vehicle_id ? ctx.vehicleName(src.vehicle_id) : "—";
          const book = src.booking_id ? ctx.bookingRef(src.booking_id) : "—";
          return `<tr>
            <td>${new Date(p.created_at).toLocaleDateString()}</td>
            <td>${escapeHtml(veh)}</td>
            <td>${escapeHtml(book)}</td>
            <td class="num">${formatCurrency(p.gross_rental_base)}</td>
            <td class="num">${formatCurrency(p.platform_fee_amount)}</td>
            <td class="num strong">${formatCurrency(p.net_to_partner)}</td>
            <td><span class="badge badge-${p.status}">${p.status}</span></td>
            <td>${p.paid_at ? new Date(p.paid_at).toLocaleDateString() : ""}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="empty">No activity in this range.</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Statement — ${escapeHtml(ctx.partnerName)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;margin:32px;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px;}
  .header h1{margin:0;font-size:24px}
  .header .meta{text-align:right;font-size:12px;color:#555}
  .header img{max-height:40px;margin-bottom:8px}
  .totals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  .totals .tile{border:1px solid #ddd;border-radius:6px;padding:12px}
  .totals .tile .l{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.04em}
  .totals .tile .v{font-size:20px;font-weight:600;margin-top:4px}
  .totals .tile.amber .v{color:#b45309}
  .totals .tile.muted .v{color:#666}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
  th{background:#f8f8f8;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#555}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  td.strong{font-weight:600}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
  .badge-paid{background:#d1fae5;color:#065f46}
  .badge-pending,.badge-scheduled{background:#fef3c7;color:#92400e}
  .badge-voided{background:#e5e7eb;color:#374151}
  .empty{text-align:center;color:#888;padding:24px 0}
  .footer{margin-top:32px;font-size:10px;color:#888;text-align:center;border-top:1px solid #eee;padding-top:12px}
  @media print {body{margin:16px} .noprint{display:none}}
</style></head>
<body>
  <div class="header">
    <div>
      ${ctx.operatorLogoUrl ? `<img src="${escapeHtml(ctx.operatorLogoUrl)}" alt="logo" />` : ""}
      <h1>${escapeHtml(ctx.operatorName || "Partner Statement")}</h1>
      <div style="color:#555;font-size:13px">${escapeHtml(ctx.partnerName)}</div>
    </div>
    <div class="meta">
      <div><strong>Statement Period</strong></div>
      <div>${escapeHtml(ctx.rangeLabel || "All time")}</div>
      <div style="margin-top:8px">Generated ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div class="totals">
    <div class="tile"><div class="l">Lifetime Paid</div><div class="v">${formatCurrency(statement.totals.lifetimePaid)}</div></div>
    <div class="tile amber"><div class="l">Outstanding</div><div class="v">${formatCurrency(statement.totals.outstanding)}</div></div>
    <div class="tile muted"><div class="l">Voided</div><div class="v">${formatCurrency(statement.totals.voided)}</div></div>
  </div>

  <table>
    <thead><tr>
      <th>Date</th><th>Vehicle</th><th>Booking</th>
      <th class="num">Gross Base</th><th class="num">Platform Fee</th><th class="num">To Partner</th>
      <th>Status</th><th>Paid On</th>
    </tr></thead>
    <tbody>${rowHtml}</tbody>
  </table>

  <div class="footer">
    Gross Base = booking subtotal at the time of payout. Platform Fee = OTA marketplace fee withheld before splitting.
    Voided payouts are excluded from outstanding balance and operator net.
  </div>

  <script>setTimeout(() => window.print(), 250);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
