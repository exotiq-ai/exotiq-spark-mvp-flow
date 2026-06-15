// Renders the counsel-drafted International Data Transfer Addendum verbatim
// from docs/compliance/legal-source/international-transfer-addendum.html.

import { useMemo } from "react";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import rawHtml from "../../../docs/compliance/legal-source/international-transfer-addendum.html?raw";
import { parseCounselHtml } from "@/lib/legal/counselHtml";

const TransferAddendum = () => {
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

export default TransferAddendum;
