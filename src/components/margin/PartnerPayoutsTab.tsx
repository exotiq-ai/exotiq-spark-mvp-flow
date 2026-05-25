import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Check } from "lucide-react";
import { toCsv, downloadCsv, formatCurrency } from "@/lib/marginCsv";
import { toast } from "sonner";

interface Payout {
  id: string;
  booking_id: string;
  partner_id: string;
  gross_rental_base: number;
  platform_fee_amount: number;
  net_after_fee: number;
  net_to_partner: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  voided: "bg-muted text-muted-foreground",
};

export function PartnerPayoutsTab() {
  const { currentTeam } = useTeam();
  const [rows, setRows] = useState<Payout[]>([]);
  const [partners, setPartners] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!currentTeam?.id) return;
    setLoading(true);
    const [{ data: ps }, { data: prs }] = await Promise.all([
      supabase.from("partner_payouts").select("*").eq("team_id", currentTeam.id).order("created_at", { ascending: false }),
      supabase.from("vehicle_partners").select("id, name").eq("team_id", currentTeam.id),
    ]);
    setRows((ps || []) as any);
    const m: Record<string, string> = {};
    (prs || []).forEach((p: any) => (m[p.id] = p.name));
    setPartners(m);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [currentTeam?.id]);

  const markPaid = async (id: string) => {
    const { error } = await supabase
      .from("partner_payouts")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid");
    refresh();
  };

  const handleExport = () => {
    const csv = toCsv(
      rows.map((r) => ({ ...r, partner: partners[r.partner_id] || r.partner_id })) as any,
      [
        { key: "created_at", label: "Created" },
        { key: "partner", label: "Partner" },
        { key: "booking_id", label: "Booking" },
        { key: "gross_rental_base", label: "Gross Base" },
        { key: "platform_fee_amount", label: "Platform Fee" },
        { key: "net_after_fee", label: "Net After Fee" },
        { key: "net_to_partner", label: "Net to Partner" },
        { key: "status", label: "Status" },
        { key: "paid_at", label: "Paid At" },
      ]
    );
    downloadCsv(`partner-payouts-${Date.now()}.csv`, csv);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Partner Payouts</CardTitle>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Gross Base</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">To Partner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No partner payouts yet. Partnered vehicles generate payouts on booking completion.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{partners[r.partner_id] || "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.gross_rental_base)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.platform_fee_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.net_after_fee)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.net_to_partner)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[r.status] || ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => markPaid(r.id)}>
                          <Check className="h-4 w-4 mr-1" /> Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
