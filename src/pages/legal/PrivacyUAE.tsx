// UAE Privacy Notice — counsel-drafted source rendered as React.
// Operator-facing; specific lawful-basis profiles for DIFC / ADGM are
// surfaced when the operator selects those jurisdictions.

import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const PrivacyUAE = () => {
  return (
    <LegalPageLayout
      title="Privacy Notice (UAE)"
      subtitle="For data subjects in the United Arab Emirates"
      effectiveDate="June 14, 2026"
      lastUpdated="June 14, 2026"
    >
      <p>
        This notice describes how Exotiq processes personal data of individuals
        located in the United Arab Emirates, including the Dubai International
        Financial Centre (DIFC) and the Abu Dhabi Global Market (ADGM) free
        zones.
      </p>

      <h2>1. Applicable laws</h2>
      <p>
        Depending on where the operator is established, processing is governed
        by the Federal PDPL (UAE Federal Decree-Law No. 45/2021), the DIFC
        Data Protection Law (DIFC Law No. 5 of 2020) or the ADGM Data
        Protection Regulations 2021. Where DIFC or ADGM applies, the operator
        identifies that on signup and we route requests accordingly.
      </p>

      <h2>2. Categories of personal data</h2>
      <p>
        Identity and contact details; account credentials; booking and rental
        records; payment-related records (processed by Stripe; we receive
        tokens and status, not card numbers); voice recordings and conversation
        logs from the Rari assistant; documents and electronic signatures
        stored in encrypted cloud storage; technical data such as IP, device,
        and usage information.
      </p>

      <h2>3. Purposes and lawful bases</h2>
      <ul>
        <li>Performance of contract — to provide the Services.</li>
        <li>Legitimate interests — fraud prevention and account security.</li>
        <li>Legal obligation — tax, AML, and regulator reporting.</li>
        <li>Consent — marketing communications, optional features.</li>
      </ul>

      <h2>4. Cross-border transfers</h2>
      <p>
        Personal data may be transferred outside the UAE / DIFC / ADGM to
        jurisdictions that provide an adequate level of protection or under
        appropriate safeguards including Standard Contractual Clauses and the
        protections in our International Data Transfer Addendum.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Subject to the applicable law you have rights of access, correction,
        deletion, restriction of processing, withdrawal of consent, and to
        object to processing. To exercise these rights contact your operator
        account directly or privacy@exotiq.ai. We respond within the
        statutory period.
      </p>

      <h2>6. Data Protection Officer</h2>
      <p>
        Where required by DIFC or ADGM, the operator appoints a Data
        Protection Officer whose contact details are surfaced in the
        operator account.
      </p>

      <h2>7. Automated decision-making</h2>
      <p>
        We do not make decisions producing legal or similarly significant
        effects about data subjects solely by automated means. Under DIFC AI
        rules, AI-assisted outputs are advisory only and reviewed by a human
        operator. Data subjects can request information about the logic
        involved by contacting privacy@exotiq.ai.
      </p>

      <h2>8. Contact</h2>
      <p>privacy@exotiq.ai.</p>
    </LegalPageLayout>
  );
};

export default PrivacyUAE;
