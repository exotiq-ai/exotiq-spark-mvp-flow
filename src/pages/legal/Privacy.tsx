import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const Privacy = () => {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="Exotiq Inc."
      effectiveDate="January 1, 2026"
      lastUpdated="March 2026"
    >
      <p>
        Exotiq Inc. ("Exotiq," "we," "us," or "our"), a Delaware C-Corporation, is committed to protecting the privacy and security of information collected through the Exotiq Command Center platform (the "Platform") and the Drive Exotiq marketplace. This Privacy Policy describes the types of information we collect, how we use and share that information, and the choices available to you regarding our use of your information.
      </p>
      <p>
        This Privacy Policy applies to all users of the Platform, including fleet operators ("Customers"), their authorized users, Vehicle Partners, and renters who interact with the Drive Exotiq marketplace. This Privacy Policy is incorporated into and forms part of our Terms and Conditions.
      </p>

      <h1>1. Information We Collect</h1>

      <h2>1.1 Account Information</h2>
      <p>When you create an account, we collect your name, email address, phone number, business name, business address, and payment information. Payment credentials are processed and stored exclusively by Stripe, Inc. and are not stored on Exotiq's systems.</p>

      <h2>1.2 Fleet and Operational Data</h2>
      <p>Through your use of the Platform, we collect and process the following categories of data: vehicle inventory data (make, model, year, VIN, mileage, photographs, specifications); booking and reservation records; renter information you enter (names, contact details, driver license data, rental history); maintenance records and schedules; pricing data and pricing history; insurance and compliance documentation uploaded to Vault; and financial transaction records synchronized from Stripe.</p>

      <h2>1.3 AI Interaction Data</h2>
      <p>When you use AI Services, we collect: MotorIQ usage data, including pricing queries, applied recommendations, and pricing outcomes; FleetCopilot and Rari conversation logs, including text and voice inputs; voice recordings processed through ElevenLabs for the Rari voice agent; and AI recommendation acceptance and rejection patterns used for model improvement.</p>

      <h2>1.4 Technical and Usage Data</h2>
      <p>We automatically collect: IP addresses, browser type, device information, and operating system; pages viewed, features accessed, and session duration; error logs and performance diagnostics; and telematics data received from integrated providers (GPS coordinates, vehicle diagnostics, driving behavior data).</p>

      <h2>1.5 Drive Exotiq Marketplace Data</h2>
      <p>For renters using the Drive Exotiq marketplace, we collect: name, email address, phone number, and payment information (processed exclusively by Stripe); and search queries, booking preferences, and rental history on the marketplace.</p>

      <h2>1.6 Document and Signature Data</h2>
      <p>When you use Vault for document management and electronic signatures, we collect: uploaded documents and associated metadata; signature images captured through the built-in canvas signature tool; signer identification data (name, email address, IP address, timestamp); and document reference numbers (EXQ-DOC-YYYY-NNNNN) and associated audit trails.</p>

      <h1>2. How We Use Your Information</h1>

      <h2>2.1 Platform Operations</h2>
      <p>We use your information to: provide, maintain, and improve the Platform and its constituent modules; process bookings, payments, and financial transactions; generate AI-powered pricing recommendations via MotorIQ; power conversational AI features through FleetCopilot and Rari; monitor fleet compliance status and deliver expiration alerts through Vault; and calculate vehicle profitability and financial analytics through Margin.</p>

      <h2>2.2 AI Model Training and Improvement</h2>
      <p>We use aggregated, anonymized operational data to train and improve our proprietary AI models, including pricing algorithms, demand forecasting models, and maintenance prediction systems. We do not use individually identifiable Customer Data to train AI models that are shared across customers without obtaining your explicit prior consent.</p>

      <h2>2.3 Communications</h2>
      <p>We use your contact information to send: transactional emails (booking confirmations, payment receipts, compliance alerts) via Resend; product updates and feature announcements; and security notifications. You may opt out of non-transactional communications at any time.</p>

      <h2>2.4 Analytics and Product Improvement</h2>
      <p>We analyze usage patterns to improve Platform performance and reliability, develop new features and modules, identify and resolve technical issues, and generate aggregated industry benchmarks that do not identify individual users.</p>

      <h1>3. How We Share Your Information</h1>

      <h2>3.1 Third-Party Service Providers</h2>
      <p>We share information with the following categories of service providers, solely to the extent necessary to provide and operate the Platform:</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Data Shared</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Stripe</td><td>Payment processing</td><td>Transaction data, account info</td></tr>
            <tr><td>Supabase</td><td>Database and storage</td><td>All platform data (encrypted)</td></tr>
            <tr><td>ElevenLabs</td><td>Voice AI (Rari)</td><td>Voice recordings, text prompts</td></tr>
            <tr><td>Google (Gemini)</td><td>Demand forecasting</td><td>Anonymized market queries</td></tr>
            <tr><td>OpenAI</td><td>Communication optimization</td><td>Text inputs</td></tr>
            <tr><td>Anthropic (Claude)</td><td>AI reasoning and analysis</td><td>Text inputs</td></tr>
            <tr><td>Resend</td><td>Email delivery</td><td>Email addresses, names</td></tr>
            <tr><td>Telematics*</td><td>Vehicle tracking</td><td>Vehicle IDs, credentials</td></tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm">*Telematics providers include Bouncie, Verizon Connect, and Zubie. The specific provider depends on your integration configuration.</p>

      <h2>3.2 Customer-to-Renter Data Sharing</h2>
      <p>When a renter books through Drive Exotiq, the Customer (fleet operator) receives the renter's booking details, contact information, and identification information as necessary to fulfill the rental. The Customer's handling of renter data is governed by the Customer's own privacy policy.</p>

      <h2>3.3 Legal Requirements</h2>
      <p>We may disclose information when we believe in good faith that disclosure is required by law, legal process, or government request, or when disclosure is necessary to protect the rights, property, or safety of Exotiq, our users, or the public.</p>

      <h2>3.4 Business Transfers</h2>
      <p>In the event of a merger, acquisition, reorganization, or sale of assets, your information may be transferred to the acquiring or successor entity. We will provide notice before your information becomes subject to a materially different privacy policy.</p>

      <h2>3.5 No Sale of Personal Data</h2>
      <p>Exotiq does not sell, rent, or trade personal information to third parties for their marketing or advertising purposes.</p>

      <h1>4. Data Security</h1>

      <h2>4.1 Security Measures</h2>
      <p>We implement commercially reasonable technical and organizational security measures, including: encryption of data at rest and in transit (TLS 1.2 or higher); row-level security (RLS) policies ensuring logical data isolation between Customers; secure API authentication and access controls; regular security assessments and vulnerability testing; encrypted document storage for Vault; and automated backup procedures with encrypted backup storage.</p>

      <h2>4.2 Incident Response</h2>
      <p>In the event of a confirmed data breach affecting your personal information, we will: notify affected users within seventy-two (72) hours of confirmed discovery; provide details regarding the nature of the breach, categories of data affected, and remedial actions taken; cooperate with law enforcement and regulatory authorities as required; and implement measures reasonably designed to prevent recurrence.</p>

      <h2>4.3 Security Limitations</h2>
      <p>No method of electronic transmission or storage is completely secure. While we take commercially reasonable precautions, we cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials and for all activity occurring under your account.</p>

      <h1>5. Data Retention</h1>
      <p>We retain your information in accordance with the following schedule:</p>
      <ul>
        <li><strong>Active account data:</strong> retained for the duration of your subscription.</li>
        <li><strong>Post-termination:</strong> Customer Data available for export for thirty (30) days, then deleted from active systems within sixty (60) additional days.</li>
        <li><strong>Backup copies:</strong> encrypted backups retained for up to ninety (90) days following deletion from active systems.</li>
        <li><strong>Transaction records:</strong> retained for seven (7) years for financial, tax, and legal compliance purposes.</li>
        <li><strong>Aggregated, anonymized data:</strong> retained indefinitely for product improvement and benchmarking.</li>
        <li><strong>Voice recordings (Rari):</strong> retained for thirty (30) days for quality improvement, then permanently deleted.</li>
        <li><strong>Document signatures and audit trails:</strong> retained for the subscription term plus seven (7) years for legal compliance.</li>
      </ul>

      <h1>6. Your Rights and Choices</h1>

      <h2>6.1 Access and Portability</h2>
      <p>You may request a copy of your personal information in a standard machine-readable format. Please refer to Section 4.4 of the Terms and Conditions for data export procedures and associated terms.</p>

      <h2>6.2 Correction</h2>
      <p>You may update or correct your account information through the Platform at any time. For corrections to data that cannot be modified through self-service tools, please contact privacy@exotiq.ai.</p>

      <h2>6.3 Deletion</h2>
      <p>You may request deletion of your personal information by contacting privacy@exotiq.ai. Deletion requests will be processed within thirty (30) days, subject to any legal retention requirements.</p>

      <h2>6.4 Opt-Out Rights</h2>
      <p>You may opt out of the following: non-transactional marketing communications (via unsubscribe link or account settings); AI model training using your individually identifiable data (by contacting privacy@exotiq.ai); and telematics data collection (by disconnecting your telematics integration).</p>

      <h2>6.5 State-Specific Privacy Rights</h2>
      <p>If you are a resident of California, Colorado, Virginia, Connecticut, or another state that has enacted comprehensive consumer privacy legislation, you may have additional rights, including the right to know what personal information is collected, the right to request deletion, the right to opt out of certain data processing activities, and the right to non-discrimination for exercising your privacy rights. To exercise any state-specific rights, please contact privacy@exotiq.ai with your request and your state of residence.</p>

      <h1>7. Children's Privacy</h1>
      <p>The Platform is designed for use by businesses and is not intended for use by individuals under the age of eighteen (18). We do not knowingly collect personal information from minors. If we become aware that we have inadvertently collected information from a minor, we will take steps to delete such information promptly.</p>

      <h1>8. International Data Transfers</h1>
      <p>The Platform is hosted and operated in the United States. If you access the Platform from outside the United States, you acknowledge and consent to the transfer of your information to the United States for processing and storage. We will take reasonable steps to ensure that your data is treated securely and in accordance with this Privacy Policy and applicable law.</p>

      <h1>9. Cookies and Tracking Technologies</h1>
      <p>The Platform uses essential cookies for authentication and session management. We may use analytics tools to understand Platform usage patterns. You may manage cookie preferences through your browser settings. We do not use advertising cookies and do not participate in third-party advertising networks.</p>

      <h1>10. Changes to This Privacy Policy</h1>
      <p>We may update this Privacy Policy from time to time. Material changes will be communicated via email to the address associated with your account at least thirty (30) days before the effective date. Your continued use of the Platform after the effective date of any revised Privacy Policy shall constitute your acceptance of the updated terms.</p>

      <h1>11. Contact Information</h1>
      <p>For privacy-related inquiries or to exercise your rights under this Privacy Policy, please contact:</p>
      <p>Email: <a href="mailto:privacy@exotiq.ai">privacy@exotiq.ai</a></p>
      <p>Mailing Address: Exotiq Inc., Delaware</p>
    </LegalPageLayout>
  );
};

export default Privacy;
