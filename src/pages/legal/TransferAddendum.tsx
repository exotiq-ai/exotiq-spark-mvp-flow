// International Data Transfer Addendum — counsel-drafted source rendered
// as a versioned React page. Surfaced from the EU/UK privacy notice and
// from the DPA acceptance flow when the operator's jurisdiction is EU/UK.

import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const TransferAddendum = () => {
  return (
    <LegalPageLayout
      title="International Data Transfer Addendum"
      subtitle="Standard Contractual Clauses module and UK IDTA addendum"
      effectiveDate="June 14, 2026"
      lastUpdated="June 14, 2026"
    >
      <p>
        This Addendum forms part of the Data Processing Agreement between
        Exotiq and the Operator and applies whenever personal data is
        transferred from the European Economic Area, the United Kingdom or
        Switzerland to a third country that does not benefit from an adequacy
        decision.
      </p>

      <h2>1. Incorporated clauses</h2>
      <ul>
        <li>
          <strong>EU SCCs (Commission Decision 2021/914):</strong> Module Two
          (Controller-to-Processor) applies where Exotiq processes personal
          data on behalf of the Operator. Module Three (Processor-to-Processor)
          applies where Exotiq engages sub-processors.
        </li>
        <li>
          <strong>UK International Data Transfer Addendum</strong> issued by
          the Information Commissioner, version B1.0, applies to transfers
          subject to the UK GDPR.
        </li>
        <li>
          <strong>Swiss FDPIC requirements</strong> are met by treating the
          FDPIC as the relevant supervisory authority where the transfer
          relates to data subjects in Switzerland.
        </li>
      </ul>

      <h2>2. Docking clause and signature</h2>
      <p>
        Acceptance of the Data Processing Agreement constitutes execution of
        this Addendum by both parties. Sub-processors may dock onto these
        Clauses by signing the relevant accession agreement.
      </p>

      <h2>3. Technical and organizational measures</h2>
      <p>
        The TOMs described in Annex II of the Data Processing Agreement apply
        to transfers under this Addendum, including encryption in transit
        (TLS 1.2+) and at rest (AES-256), strict role-based access control,
        immutable audit logging of personal-data access, and a transfer guard
        layer that redacts personal data before any call to an AI provider.
      </p>

      <h2>4. Supplementary measures</h2>
      <p>
        We perform Transfer Impact Assessments for each importing jurisdiction
        on a risk basis and document them in our Records of Processing. We
        notify the Operator without undue delay of any binding request from a
        public authority unless legally prohibited.
      </p>

      <h2>5. Governing law and forum</h2>
      <p>
        Clause 17 (governing law) is completed by reference to the law of the
        Republic of Ireland. Clause 18 (forum) is completed by reference to
        the courts of Ireland for EU transfers, the courts of England and
        Wales for UK transfers, and the courts of Zurich for Swiss transfers.
      </p>

      <h2>6. Contact</h2>
      <p>privacy@exotiq.ai.</p>
    </LegalPageLayout>
  );
};

export default TransferAddendum;
