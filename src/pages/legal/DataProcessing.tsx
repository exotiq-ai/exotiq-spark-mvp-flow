import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const DataProcessing = () => {
  return (
    <LegalPageLayout
      title="Data Processing Agreement"
      subtitle="Controller-Processor Agreement"
      effectiveDate="January 1, 2026"
      lastUpdated="March 2026"
    >
      <p>
        This Data Processing Agreement ("DPA") is entered into by and between the Customer identified in the applicable Terms and Conditions (the "Controller" or "Customer") and Exotiq Inc., a Delaware C-Corporation (the "Processor" or "Exotiq"), and supplements the Terms and Conditions (the "Agreement") governing the Customer's use of the Exotiq Command Center platform.
      </p>
      <p>
        This DPA applies to the extent that Exotiq processes personal data on behalf of the Customer that is subject to applicable data protection laws, including but not limited to the California Consumer Privacy Act, as amended ("CCPA"), the Colorado Privacy Act ("CPA"), the Virginia Consumer Data Protection Act ("VCDPA"), and, where applicable, Regulation (EU) 2016/679 (the "General Data Protection Regulation" or "GDPR").
      </p>

      <h1>1. Definitions</h1>
      <p>In addition to the definitions set forth in the Agreement, the following terms shall have the meanings ascribed below:</p>
      <ul>
        <li><strong>"Personal Data"</strong> means any information that relates to an identified or identifiable natural person, as defined under applicable data protection laws.</li>
        <li><strong>"Processing"</strong> means any operation or set of operations performed on Personal Data, whether or not by automated means, including collection, recording, organization, structuring, storage, adaptation, alteration, retrieval, consultation, use, disclosure by transmission, dissemination, alignment, combination, restriction, erasure, or destruction.</li>
        <li><strong>"Data Subject"</strong> means the identified or identifiable natural person to whom Personal Data relates, including renters, Vehicle Partners, and Customer employees or authorized users.</li>
        <li><strong>"Sub-processor"</strong> means any third party engaged by the Processor to process Personal Data on behalf of the Controller.</li>
        <li><strong>"Security Incident"</strong> means a confirmed breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data transmitted, stored, or otherwise processed by the Processor.</li>
      </ul>

      <h1>2. Scope and Purpose of Processing</h1>

      <h2>2.1 Categories of Data Subjects</h2>
      <p>Personal Data processed under this DPA may relate to the following categories of Data Subjects: renters who book vehicles through the Platform or the Drive Exotiq marketplace; Vehicle Partners who consign vehicles to the Customer; Customer employees, contractors, and authorized users; and other individuals whose Personal Data is entered into the Platform by the Customer.</p>

      <h2>2.2 Types of Personal Data</h2>
      <p>The following categories of Personal Data may be processed: contact information (name, email address, telephone number, mailing address); identification documents (driver license information, government-issued identification, photographs); financial data (transaction records, payment method information processed by Stripe); vehicle usage data (booking history, rental records, telematics data); voice recordings (FleetCopilot and Rari interactions processed by ElevenLabs); document data (rental agreements, compliance documents, and signature images stored in Vault); and communication records (email correspondence, FleetCopilot conversation logs).</p>

      <h2>2.3 Purpose Limitation</h2>
      <p>The Processor shall process Personal Data solely for the following purposes: providing the Platform and its modules as described in the Agreement; generating AI-driven insights, pricing recommendations, and analytics for the Controller; processing payments through Stripe Connect; sending transactional communications on behalf of the Controller via Resend; providing technical support; and performing anonymized data aggregation for product improvement and benchmarking.</p>

      <h1>3. Obligations of the Processor</h1>

      <h2>3.1 Processing Instructions</h2>
      <p>The Processor shall process Personal Data only in accordance with the documented instructions of the Controller. The Agreement and this DPA constitute documented instructions for the purposes of applicable data protection law. If the Processor is required by applicable law to process Personal Data beyond the Controller's documented instructions, the Processor shall inform the Controller of such legal requirement prior to the relevant processing, unless prohibited from doing so by applicable law.</p>

      <h2>3.2 Confidentiality</h2>
      <p>The Processor shall ensure that all personnel authorized to process Personal Data have committed to contractual or statutory confidentiality obligations. Access to Personal Data shall be limited to personnel who require such access for the performance of their duties in connection with the Agreement.</p>

      <h2>3.3 Technical and Organizational Security Measures</h2>
      <p>The Processor shall implement and maintain appropriate technical and organizational measures to protect Personal Data against unauthorized or unlawful processing and against accidental loss, destruction, damage, theft, or disclosure. Such measures shall include, at a minimum:</p>
      <ul>
        <li>Encryption of Personal Data at rest and in transit (TLS 1.2 or higher).</li>
        <li>Row-level security (RLS) policies ensuring logical data separation between Controller accounts.</li>
        <li>Authentication and role-based access control mechanisms.</li>
        <li>Regular security testing and vulnerability assessments.</li>
        <li>Secure cloud infrastructure (hosted on Amazon Web Services).</li>
        <li>Encrypted document storage for Vault.</li>
        <li>Automated and encrypted backup procedures.</li>
      </ul>

      <h2>3.4 Assistance with Data Subject Requests</h2>
      <p>If the Processor receives a request from a Data Subject to exercise rights under applicable data protection law, the Processor shall: (a) promptly notify the Controller of such request; (b) provide reasonable assistance to the Controller in fulfilling the request through available Platform features; and (c) refrain from independently responding to the Data Subject unless expressly authorized by the Controller or required by applicable law.</p>

      <h2>3.5 Security Incident Notification</h2>
      <p>In the event of a Security Incident involving Personal Data processed under this DPA, the Processor shall: (a) notify the Controller without undue delay and in any event no later than seventy-two (72) hours after becoming aware of the Security Incident; (b) provide a written description of the nature of the incident, the categories and approximate number of Data Subjects affected, the likely consequences, and the measures taken or proposed to address the incident; (c) cooperate with the Controller in fulfilling any legal notification obligations; and (d) document the Security Incident and all response actions taken.</p>

      <h1>4. Sub-processors</h1>

      <h2>4.1 General Authorization</h2>
      <p>The Controller hereby provides general written authorization for the Processor to engage Sub-processors for the processing of Personal Data, subject to the requirements of this Section. As of the effective date, the Controller authorizes the following categories of Sub-processors:</p>
      <ul>
        <li>Cloud infrastructure and database services (hosted on Amazon Web Services).</li>
        <li>Payment processing services (Stripe, Inc.).</li>
        <li>AI and machine learning services (ElevenLabs, Google LLC, OpenAI, Anthropic PBC).</li>
        <li>Email delivery services (Resend).</li>
        <li>Telematics data providers (as configured by the Controller).</li>
      </ul>

      <h2>4.2 Sub-processor Obligations</h2>
      <p>The Processor shall: (a) impose data protection obligations on each Sub-processor by written contract that are materially no less protective than those in this DPA; (b) remain fully liable to the Controller for the performance of each Sub-processor's obligations; and (c) maintain a current list of Sub-processors, available upon written request.</p>

      <h2>4.3 Notification of New Sub-processors</h2>
      <p>The Processor shall provide the Controller with not less than thirty (30) days prior written notice before engaging any new Sub-processor. If the Controller objects on reasonable and documented data protection grounds, the parties shall discuss the objection in good faith. If no resolution is reached within thirty (30) days, the Controller may terminate the Agreement without penalty upon thirty (30) days written notice.</p>

      <h1>5. International Data Transfers</h1>
      <p>Personal Data processed under this DPA is stored and processed in the United States. In the event that Personal Data is transferred from a jurisdiction with data transfer restrictions (including the European Economic Area, the United Kingdom, or Switzerland), the parties shall implement appropriate transfer mechanisms as required by applicable law, which may include Standard Contractual Clauses or other legally recognized mechanisms.</p>

      <h1>6. Data Retention and Deletion</h1>

      <h2>6.1 Retention During Subscription</h2>
      <p>The Processor shall retain Personal Data for the duration of the Controller's active subscription, subject to the retention periods specified in the Privacy Policy.</p>

      <h2>6.2 Post-Termination Obligations</h2>
      <p>Upon termination of the Agreement: (a) Customer Data (including Personal Data) shall be available for export for thirty (30) days; (b) Personal Data shall be deleted from active systems within sixty (60) additional days; (c) encrypted backups containing Personal Data shall be purged within ninety (90) days following deletion from active systems; (d) transaction records shall be retained for seven (7) years for legal and tax compliance; and (e) document signature audit trails shall be retained for the subscription term plus seven (7) years.</p>

      <h2>6.3 Certification of Deletion</h2>
      <p>Upon the Controller's written request, the Processor shall provide written certification confirming the deletion of Personal Data from active systems and backup storage, subject to any legally required retention periods.</p>

      <h1>7. Audit Rights</h1>

      <h2>7.1 Information Requests</h2>
      <p>The Processor shall make available to the Controller all information reasonably necessary to demonstrate compliance with this DPA, including summaries of technical and organizational security measures, current Sub-processor lists, and relevant Security Incident logs.</p>

      <h2>7.2 On-Site and Remote Audits</h2>
      <p>The Controller may conduct, or engage a qualified independent third-party auditor to conduct, an audit of the Processor's data processing activities, subject to: (a) thirty (30) days advance written notice; (b) scope limited to the Processor's processing of the Controller's Personal Data; (c) conducted during normal business hours with minimal disruption; (d) the Controller bearing reasonable costs; and (e) the auditor entering into appropriate confidentiality obligations.</p>

      <h2>7.3 Frequency</h2>
      <p>Audits may be conducted no more than once in any twelve (12) month period, unless a Security Incident has occurred or a regulatory authority requires an audit.</p>

      <h1>8. CCPA-Specific Provisions</h1>
      <p>To the extent that the Processor processes Personal Data subject to the California Consumer Privacy Act, as amended ("CCPA"):</p>
      <ol>
        <li>The Processor processes Personal Data as a "Service Provider" as defined under the CCPA.</li>
        <li>The Processor shall not sell or share (as defined under the CCPA) Personal Data received from the Controller.</li>
        <li>The Processor shall not retain, use, or disclose Personal Data for any purpose other than the business purposes specified in the Agreement and this DPA.</li>
        <li>The Processor shall not combine Personal Data received from the Controller with personal information from other sources, except as permitted by the CCPA.</li>
        <li>The Processor hereby certifies that it understands and shall comply with the restrictions set forth in this Section 8.</li>
      </ol>

      <h1>9. Cooperation and Assistance</h1>
      <p>The Processor shall provide reasonable cooperation and assistance to the Controller in connection with: (a) responding to Data Subject requests; (b) conducting data protection impact assessments, where required; (c) prior consultation with regulatory authorities, where required; and (d) fulfilling the Controller's obligations under applicable data protection laws.</p>

      <h1>10. Liability</h1>
      <p>Each party's liability arising out of or in connection with this DPA shall be subject to the limitations of liability set forth in the Agreement. This DPA does not create additional or independent bases for liability beyond what is established in the Agreement, except to the extent that applicable data protection law requires otherwise.</p>

      <h1>11. Term and Termination</h1>
      <p>This DPA shall take effect on the date the Controller first accesses the Platform and shall remain in effect for the duration of the Agreement. The obligations set forth in this DPA shall survive termination or expiration of the Agreement to the extent necessary to complete any ongoing data processing, deletion, retention, or compliance obligations.</p>

      <h1>12. Governing Law</h1>
      <p>This DPA shall be governed by the same governing law provisions as the Agreement (the laws of the State of Delaware). To the extent that applicable data protection law mandates application of a different governing law to specific provisions of this DPA, such law shall apply to those provisions only.</p>

      <h1>13. Order of Precedence</h1>
      <p>In the event of any conflict between this DPA and the Agreement, this DPA shall prevail with respect to matters of data protection. In the event of any conflict between this DPA and applicable mandatory data protection law, applicable law shall prevail.</p>

      <p className="mt-8 text-sm">Exotiq Inc., a Delaware C-Corporation</p>
    </LegalPageLayout>
  );
};

export default DataProcessing;
