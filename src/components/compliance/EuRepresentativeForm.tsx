// EU and UK appointed-representative form. Owner/admin only.
// Required for EU/UK privacy notices to render the legally required
// representative block (GDPR Art. 27 / UK GDPR Art. 27).

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";

type Reg = "eu" | "uk";

const fields: { region: Reg; label: string }[] = [
  { region: "eu", label: "EU representative (GDPR Art. 27)" },
  { region: "uk", label: "UK representative (UK GDPR Art. 27)" },
];

export const EuRepresentativeForm = () => {
  const { currentTeam, userRole, refreshTeam } = useTeam();
  const { toast } = useToast();
  const canEdit = userRole === "owner" || userRole === "admin";
  const [saving, setSaving] = useState<Reg | null>(null);
  const [state, setState] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = currentTeam as any;
    if (!t) return;
    setState({
      eu_representative_name: t.eu_representative_name ?? "",
      eu_representative_address: t.eu_representative_address ?? "",
      eu_representative_email: t.eu_representative_email ?? "",
      uk_representative_name: t.uk_representative_name ?? "",
      uk_representative_address: t.uk_representative_address ?? "",
      uk_representative_email: t.uk_representative_email ?? "",
    });
  }, [currentTeam?.id]);

  const save = async (r: Reg) => {
    if (!currentTeam?.id) return;
    setSaving(r);
    const patch: Record<string, string | null> = {
      [`${r}_representative_name`]: state[`${r}_representative_name`] || null,
      [`${r}_representative_address`]: state[`${r}_representative_address`] || null,
      [`${r}_representative_email`]: state[`${r}_representative_email`] || null,
    };
    const { error } = await (supabase.from("teams") as any)
      .update(patch)
      .eq("id", currentTeam.id);
    setSaving(null);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Representative saved" });
    await refreshTeam?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Appointed representatives
        </CardTitle>
        <CardDescription>
          Operators with EU or UK data subjects must appoint a local
          representative whose details appear in the renter-facing privacy
          notice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {fields.map((f) => (
          <div key={f.region} className="space-y-2 rounded-md border border-border/60 p-3">
            <p className="text-sm font-medium">{f.label}</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs" htmlFor={`${f.region}-name`}>
                  Name
                </Label>
                <Input
                  id={`${f.region}-name`}
                  value={state[`${f.region}_representative_name`] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setState({ ...state, [`${f.region}_representative_name`]: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor={`${f.region}-email`}>
                  Email
                </Label>
                <Input
                  id={`${f.region}-email`}
                  type="email"
                  value={state[`${f.region}_representative_email`] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setState({ ...state, [`${f.region}_representative_email`]: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor={`${f.region}-address`}>
                  Postal address
                </Label>
                <Input
                  id={`${f.region}-address`}
                  value={state[`${f.region}_representative_address`] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setState({ ...state, [`${f.region}_representative_address`]: e.target.value })
                  }
                />
              </div>
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(f.region)} disabled={saving === f.region}>
                  {saving === f.region && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Save {f.region.toUpperCase()}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
