import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const DataProcessing = () => {
  return (
    <LegalPageLayout
      title="Data Processing Agreement"
      subtitle="Controller-Processor Agreement for Customer Data"
      effectiveDate="January 1, 2026"
      lastUpdated="June 14, 2026"
    >
      <p>This Data Processing Agreement ("DPA") supplements the Terms and Conditions between you ("Controller" or "Customer") and Exotiq Inc. ("Processor" or "Exotiq"), and governs the processing of personal data by Exotiq on behalf of the Customer.</p>
      <p>This DPA applies to the extent that Exotiq processes personal data subject to the CCPA, Colorado Privacy Act, VCDPA, and where applicable, the GDPR.</p>

      <h2>Article I: Definitions</h2>
      <p><strong>"Personal Data"</strong> means any information relating to an identified or identifiable natural person.</p>
      <p><strong>"Processing"</strong> means any operation performed on Personal Data.</p>
      <p><strong>"Data Subject"</strong> means the natural person to whom Personal Data relates.</p>
      <p><strong>"Sub-processor"</strong> means any third party engaged by Exotiq to process Personal Data.</p>
      <p><strong>"Security Incident"</strong> means a confirmed breach leading to unauthorized access to Personal Data.</p>

      <h2>Article II: Scope and Purpose</h2>
      <p>Personal Data processed may relate to: renters, Vehicle Partners, Customer employees, and other individuals whose data is entered into the Platform. Categories include: contact information, identification documents, financial data, vehicle usage data, voice recordings, document data, communication records, and SMS/text messaging data (phone numbers, message content, consent records).</p>
      <p>Exotiq processes Personal Data solely for: (a) providing the Platform; (b) generating AI insights; (c) processing payments via Stripe; (d) sending communications via Resend (email), GoHighLevel (SMS), and Twilio (SMS); (e) technical support; and (f) anonymized aggregation.</p>

      <h2>Article III: Processor Obligations</h2>
      <p>Exotiq will: process data only on documented instructions; ensure personnel confidentiality; implement appropriate security measures (encryption, row-level security, access controls); assist with Data Subject requests; and notify Customer of Security Incidents within 72 hours.</p>

      <h2>Article IV: Sub-processors</h2>
      <table>
        <thead>
          <tr><th>Sub-processor</th><th>Purpose</th><th>Data Processed</th></tr>
        </thead>
        <tbody>
          <tr><td>Encrypted cloud storage (AWS)</td><td>Cloud infrastructure, database</td><td>All platform data (encrypted)</td></tr>
          <tr><td>Stripe</td><td>Payment processing</td><td>Transaction data, payment methods</td></tr>
          <tr><td>ElevenLabs</td><td>Voice AI (Rari)</td><td>Voice recordings, text prompts</td></tr>
          <tr><td>Google (Gemini API)</td><td>Demand forecasting, AI</td><td>Anonymized market queries</td></tr>
          <tr><td>OpenAI</td><td>Communication optimization</td><td>Text inputs</td></tr>
          <tr><td>Anthropic (Claude)</td><td>AI reasoning</td><td>Text inputs</td></tr>
          <tr><td>Resend</td><td>Email delivery</td><td>Email addresses, message content</td></tr>
          <tr><td>GoHighLevel</td><td>SMS/text delivery, CRM</td><td>Phone numbers, messages, consent data</td></tr>
          <tr><td>Twilio</td><td>SMS delivery infrastructure</td><td>Phone numbers, message content</td></tr>
          <tr><td>Telematics providers*</td><td>Vehicle tracking</td><td>Vehicle ID, location, diagnostics</td></tr>
        </tbody>
      </table>
      <p><em>*Bouncie, Verizon Connect, Zubie, as configured by Customer.</em></p>
      <p>Exotiq will provide thirty (30) days notice before engaging new Sub-processors. Objections on data protection grounds will be discussed in good faith.</p>

      <h2>Article V: Data Retention and Deletion</h2>
      <p>Post-termination: data available for export for 30 days, deleted within 60 additional days, backups purged within 90 days. Transaction records retained 7 years. SMS consent records retained at least 5 years (TCPA compliance). Certification of deletion available upon request.</p>

      <h2>Article VI: Audit Rights</h2>
      <p>Customer may conduct audits with 30 days notice, limited to Customer's data, during business hours, at Customer's cost, no more than once per 12 months.</p>

      <h2>Article VII: CCPA Provisions</h2>
      <p>Exotiq processes data as a "Service Provider" under the CCPA. Exotiq will not sell Personal Data, will not use data beyond specified purposes, and certifies compliance.</p>

      <h2>Article VIII: Governing Law</h2>
      <p>Governed by the laws of the State of Delaware.</p>

      <h2>Contact</h2>
      <p><strong>Email:</strong> <a href="mailto:privacy@exotiq.ai">privacy@exotiq.ai</a></p>
      <p><strong>Address:</strong> Exotiq Inc., 1001 S Main St #6709, Kalispell, MT 59901</p>
    </LegalPageLayout>
  );
};

export default DataProcessing;
