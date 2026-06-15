// Renders the counsel-drafted UAE privacy notice verbatim from
// docs/compliance/legal-source/privacy-notice-uae.html.

import { useMemo } from "react";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import rawHtml from "../../../docs/compliance/legal-source/privacy-notice-uae.html?raw";
import { parseCounselHtml } from "@/lib/legal/counselHtml";

const PrivacyUAE = () => {
  const parsed = useMemo(() => parseCounselHtml(rawHtml), []);
  return (
    <LegalPageLayout
      title={parsed.title}
      subtitle={parsed.subtitle}
      effectiveDate={parsed.effectiveDate}
      lastUpdated={parsed.lastUpdated}
    >
      <div dangerouslySetInnerHTML={{ __html: parsed.bodyHtml }} />
    </LegalPageLayout>
  );
};

export default PrivacyUAE;
