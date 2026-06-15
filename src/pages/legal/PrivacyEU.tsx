// Renders the counsel-drafted EU/UK privacy notice verbatim from
// docs/compliance/legal-source/privacy-notice-eu-uk.html. The operator's
// stored EU/UK Article 27 representative (if any) is injected in place of
// the counsel placeholder; otherwise the placeholder remains as drafted.

import { useEffect, useMemo, useState } from "react";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { supabase } from "@/integrations/supabase/client";
import rawHtml from "../../../docs/compliance/legal-source/privacy-notice-eu-uk.html?raw";
import {
  parseCounselHtml,
  injectEuUkRepresentatives,
  type RepInjection,
} from "@/lib/legal/counselHtml";

const PrivacyEU = () => {
  const parsed = useMemo(() => parseCounselHtml(rawHtml), []);
  const [rep, setRep] = useState<RepInjection>({});

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: tm } = await (supabase.from("team_members") as any)
        .select("team_id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!tm?.team_id) return;
      const { data: team } = await (supabase.from("teams") as any)
        .select(
          "eu_representative_name, eu_representative_address, eu_representative_email, uk_representative_name, uk_representative_address, uk_representative_email"
        )
        .eq("id", tm.team_id)
        .maybeSingle();
      if (!team) return;
      setRep({
        euName: team.eu_representative_name,
        euAddress: team.eu_representative_address,
        euEmail: team.eu_representative_email,
        ukName: team.uk_representative_name,
        ukAddress: team.uk_representative_address,
        ukEmail: team.uk_representative_email,
      });
    })();
  }, []);

  const bodyHtml = useMemo(
    () => injectEuUkRepresentatives(parsed.bodyHtml, rep),
    [parsed.bodyHtml, rep],
  );

  return (
    <LegalPageLayout
      title={parsed.title}
      subtitle={parsed.subtitle}
      effectiveDate={parsed.effectiveDate}
      lastUpdated={parsed.lastUpdated}
    >
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </LegalPageLayout>
  );
};

export default PrivacyEU;
