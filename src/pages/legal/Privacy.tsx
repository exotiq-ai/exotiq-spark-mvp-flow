import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { LEGAL_DOCS } from "@/lib/legal/versions";

const Privacy = () => {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How Exotiq Collects, Uses, and Protects Your Information"
      effectiveDate={LEGAL_DOCS.privacy.effectiveDate}
      lastUpdated={LEGAL_DOCS.privacy.lastUpdated}
    >
      <p>Exotiq Inc. ("Exotiq," "we," "us," or "our"), a Delaware C-Corporation, is committed to protecting the privacy and security of information collected through the Exotiq Command Center platform ("Platform") and the Drive Exotiq marketplace. This Privacy Policy explains what information we collect, how we use it, who we share it with, and how we protect it.</p>
      <p>This Privacy Policy applies to all users of the Platform, including fleet operators ("Customers"), their authorized users, Vehicle Partners, and renters who interact with Drive Exotiq.</p>

      <h2>Article I: Information We Collect</h2>
      <h3>Section 1.1. Account Information</h3>
      <p>When you create an account, we collect: your name, email address, phone number, business name, business address, and payment information (processed and stored by Stripe, not by Exotiq directly).</p>
      <h3>Section 1.2. Fleet and Operational Data</h3>
      <p>Through your use of the Platform, we collect and process: vehicle inventory data (make, model, year, VIN, mileage, photos, specifications); booking and reservation records; renter information you enter; maintenance records and schedules; pricing data and pricing history; insurance and compliance documentation uploaded to Vault; and financial transaction records synchronized from Stripe.</p>
      <h3>Section 1.3. AI Interaction Data</h3>
      <p>When you use AI Services, we collect: MotorIQ usage data including pricing queries, applied recommendations, and pricing outcomes; FleetCopilot/Rari conversation logs including text and voice inputs; voice recordings processed through ElevenLabs for the Rari voice agent; and AI recommendation acceptance/rejection patterns used for model improvement.</p>
      <h3>Section 1.4. Technical and Usage Data</h3>
      <p>We automatically collect: IP addresses, browser type, device information, and operating system; pages viewed, features used, and session duration; error logs and performance data; and telematics data received from integrated providers (GPS location, vehicle diagnostics, driving data).</p>
      <h3>Section 1.5. SMS Consent Data</h3>
      <p>When you or your renters opt in to SMS/text messaging programs operated by Exotiq or Drive Exotiq, we collect and store: mobile phone numbers; SMS consent preferences (transactional, marketing, or both); the timestamp and IP address at the time of consent; the specific consent language presented at opt-in; and opt-out history and timestamps. These consent records are maintained for at least five (5) years after the last interaction as required for TCPA compliance.</p>

      <h2>Article II: How We Use Your Information</h2>
      <h3>Section 2.1. Platform Operations</h3>
      <p>We use your information to: provide, maintain, and improve the Platform and its modules; process bookings, payments, and financial transactions; generate AI-powered pricing recommendations via MotorIQ; power conversational AI features through FleetCopilot/Rari; monitor fleet compliance and send expiration alerts through Vault; and calculate vehicle profitability and financial analytics through Margin.</p>
      <h3>Section 2.2. AI Model Training and Improvement</h3>
      <p>We use aggregated, anonymized operational data to train and improve our proprietary AI models. We do not use individually identifiable Customer Data to train AI models shared across customers without explicit consent.</p>
      <h3>Section 2.3. Communications</h3>
      <p>We use your contact information to send transactional emails via Resend; transactional and promotional SMS messages via GoHighLevel and Twilio (only with your prior express consent); product updates and feature announcements; and security notifications. You may opt out of non-transactional communications at any time.</p>

      <h2>Article III: How We Share Your Information</h2>
      <h3>Section 3.1. Third-Party Service Providers</h3>
      <table>
        <thead>
          <tr><th>Provider</th><th>Purpose</th><th>Data Shared</th></tr>
        </thead>
        <tbody>
          <tr><td>Stripe</td><td>Payment processing</td><td>Transaction data, account information</td></tr>
          <tr><td>Encrypted cloud storage</td><td>Database and storage</td><td>All platform data (encrypted at rest)</td></tr>
          <tr><td>ElevenLabs</td><td>Voice AI (Rari)</td><td>Voice recordings, text prompts</td></tr>
          <tr><td>Google (Gemini)</td><td>Demand forecasting</td><td>Anonymized market queries</td></tr>
          <tr><td>OpenAI</td><td>Communication AI</td><td>Text inputs for optimization</td></tr>
          <tr><td>Anthropic</td><td>AI reasoning</td><td>Text inputs for analysis</td></tr>
          <tr><td>Resend</td><td>Email delivery</td><td>Email addresses, recipient names</td></tr>
          <tr><td>GoHighLevel</td><td>SMS/text delivery, CRM</td><td>Phone numbers, message content, consent data</td></tr>
          <tr><td>Twilio</td><td>SMS delivery infrastructure</td><td>Phone numbers, message content</td></tr>
          <tr><td>Telematics providers*</td><td>Vehicle tracking</td><td>Vehicle ID, account credentials</td></tr>
        </tbody>
      </table>
      <p><em>*Telematics providers include Bouncie, Verizon Connect, and Zubie.</em></p>

      <h3>Section 3.2. SMS Consent Data</h3>
      <p>We do not sell, rent, or share your SMS consent or phone number with any third parties for their marketing purposes. Your phone number and SMS consent data may only be shared with: (a) our SMS service providers (GoHighLevel and Twilio) solely for message delivery; and (b) as required by law or legal process.</p>
      <h3>Section 3.3. No Sale of Personal Data</h3>
      <p>Exotiq does not sell, rent, or trade personal information to third parties for marketing purposes.</p>

      <h2>Article IV: Data Security</h2>
      <p>We implement commercially reasonable security measures including: encryption of data at rest and in transit (TLS 1.2+); row-level security policies ensuring data isolation between customers; secure API authentication; regular security assessments; and encrypted document storage for Vault.</p>
      <p>In the event of a data breach, we will notify affected users within seventy-two (72) hours of confirmed discovery.</p>

      <h2>Article V: Data Retention</h2>
      <ul>
        <li>Active account data: retained for the duration of your subscription.</li>
        <li>Post-termination: Customer Data available for export for 30 days, then deleted within 60 additional days.</li>
        <li>Backup copies: encrypted backups retained for up to 90 days post-deletion.</li>
        <li>Transaction records: retained for seven (7) years for financial and tax compliance.</li>
        <li>Voice recordings (Rari): retained for 30 days, then deleted.</li>
        <li>Document signatures and audit trails: retained for the subscription term plus seven (7) years.</li>
        <li>SMS consent records: retained for at least five (5) years after last interaction.</li>
      </ul>

      <h2>Article VI: Your Rights</h2>
      <h3>Section 6.1. Access and Portability</h3>
      <p>You may request a copy of your personal information in CSV or JSON format.</p>
      <h3>Section 6.2. Correction</h3>
      <p>You may update or correct your account information through the Platform or by contacting <a href="mailto:privacy@exotiq.ai">privacy@exotiq.ai</a>.</p>
      <h3>Section 6.3. Deletion</h3>
      <p>You may request deletion by contacting <a href="mailto:privacy@exotiq.ai">privacy@exotiq.ai</a>. Requests processed within 30 days, subject to legal retention requirements.</p>
      <h3>Section 6.4. Opt-Out</h3>
      <p>You may opt out of: marketing communications, AI model training using identifiable data, telematics data collection, and SMS messages (reply STOP or contact support).</p>
      <h3>Section 6.5. State-Specific Rights</h3>
      <p>California, Colorado, Virginia, and Connecticut residents may have additional rights. Contact <a href="mailto:privacy@exotiq.ai">privacy@exotiq.ai</a> with your request and state of residence.</p>

      <h2>Article VII: Children's Privacy</h2>
      <p>The Platform is not intended for individuals under 18. We do not knowingly collect information from minors.</p>

      <h2>Article VIII: Changes to This Policy</h2>
      <p>Material changes communicated via email at least thirty (30) days before the effective date.</p>

      <h2>Contact</h2>
      <p><strong>Email:</strong> <a href="mailto:privacy@exotiq.ai">privacy@exotiq.ai</a></p>
      <p><strong>Address:</strong> Exotiq Inc., 1001 S Main St #6709, Kalispell, MT 59901</p>
    </LegalPageLayout>
  );
};

export default Privacy;
