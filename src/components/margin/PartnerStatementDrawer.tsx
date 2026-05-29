import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/marginCsv";
import { buildPartnerStatement, type StatementPayout } from "@/lib/partnerStatement";
import { downloadStatementCsv, printPartnerStatement } from "@/lib/statementExport";
import type { VehiclePartner } from "@/hooks/usePartners";

interface FullPayout extends StatementPayout {
  vehicle_id: string;
  booking_id: string;
}

export function PartnerStatementDrawer({
  partner,
  open,
  onOpenChange,
}: {
  partner: VehiclePartner | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { currentTeam } = useTeam();
  const [rows, setRows] = useState<FullPayout[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, string>>({});
  const [bookings, setBookings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !partner || !currentTeam?.id) return;
    (async () => {
      setLoading(true);
      const { data: ps } = await supabase
        .from("partner_payouts")
        .select("id, status, net_to_partner, gross_rental_base, platform_fee_amount, net_after_fee, paid_at, created_at, vehicle_id, booking_id")
        .eq("team_id", currentTeam.id)
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false });
      const list = (ps || []) as any as FullPayout[];
      setRows(list);

      const { data: vehs } = await supabase.from("vehicles").select("id, make, model, name").eq("team_id", currentTeam.id);
      const vm: Record<string, string> = {};
      (vehs || []).forEach((v: any) => (vm[v.id] = v.name || `${v.make} ${v.model}`));
      setVehicles(vm);

      const bookingIds = Array.from(new Set(list.map((p) => p.booking_id).filter(Boolean)));
      if (bookingIds.length) {
        const { data: bks } = await supabase.from("bookings").select("id, booking_ref").in("id", bookingIds);
        const bm: Record<string, string> = {};
        (bks || []).forEach((b: any) => (bm[b.id] = b.booking_ref || b.id.slice(0, 8)));
        setBookings(bm);
      }
      setLoading(false);
    })();
  }, [open, partner?.id, currentTeam?.id]);

  const statement = useMemo(() => buildPartnerStatement(rows), [rows]);
  const ordered = useMemo(() => [...statement.pending, ...statement.paid, ...statement.voided], [statement]);

  const handleExport = () => {
    if (!partner) return;
    downloadStatementCsv(statement, rows, {
      partnerName: partner.name,
      vehicleName: (id) => vehicles[id] || id,
      bookingRef: (id) => bookings[id] || id,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{partner?.name || "Partner"} — Statement</SheetTitle>
          <SheetDescription>
            {partner?.email || partner?.phone || "Payout history and outstanding balance."}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <Tile label="Lifetime Paid" value={formatCurrency(statement.totals.lifetimePaid)} />
          <Tile label="Outstanding" value={formatCurrency(statement.totals.outstanding)} amber />
          <Tile label="Voided" value={formatCurrency(statement.totals.voided)} muted />
        </div>

        <div className="flex justify-end mt-4">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!ordered.length}>
            <Download className="h-4 w-4 mr-2" /> Export statement
          </Button>
        </div>

        <div className="mt-3 border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead className="text-right">To Partner</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : ordered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payouts yet for this partner.</TableCell></TableRow>
              ) : (
                ordered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{vehicles[(p as FullPayout).vehicle_id] || "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{bookings[(p as FullPayout).booking_id] || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(p.net_to_partner)}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Tile({ label, value, amber, muted }: { label: string; value: string; amber?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${amber ? "text-amber-700 dark:text-amber-400" : muted ? "text-muted-foreground" : ""}`}>{value}</div>
    </div>
  );
}
