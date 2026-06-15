import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { LEGAL_DOCS } from "@/lib/legal/versions";

const Terms = () => {
  return (
    <LegalPageLayout
      title="Terms and Conditions"
      subtitle="Exotiq Command Center Platform Agreement"
      effectiveDate={LEGAL_DOCS.terms.effectiveDate}
      lastUpdated={LEGAL_DOCS.terms.lastUpdated}
    >
