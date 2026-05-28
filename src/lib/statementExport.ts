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
