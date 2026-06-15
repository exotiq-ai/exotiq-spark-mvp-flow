import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { LEGAL_DOCS } from "@/lib/legal/versions";

const Sms = () => {
  return (
    <LegalPageLayout
      title="SMS/Text Messaging Consent and Disclosure"
      subtitle="TCPA and CTIA Compliance"
      effectiveDate={LEGAL_DOCS.sms.effectiveDate}
      lastUpdated={LEGAL_DOCS.sms.lastUpdated}
    >
      <p>This SMS Policy describes the text messaging programs operated by Exotiq Inc., a Delaware C-Corporation, doing business as Drive Exotiq ("Exotiq," "Drive Exotiq," "we," "us," or "our"). For consumer-facing SMS, the brand name "Drive Exotiq" is used. For operator-facing SMS, "Exotiq" is used. Both are the same legal entity.</p>
      <p>This policy complies with the Telephone Consumer Protection Act ("TCPA"), 47 U.S.C. § 227, the Cellular Telecommunications Industry Association ("CTIA") Messaging Principles and Best Practices, applicable FCC regulations, and applicable state laws.</p>

      <h2>Article I: Two Separate SMS Programs</h2>
      <p>Exotiq operates <strong>two separate and independent SMS programs</strong>. Participation in one does not enroll you in the other.</p>
      <h3>Section 1.1. Transactional Messages</h3>
      <p>Booking confirmations, payment receipts, vehicle pickup/return reminders, fleet alerts, AI-generated operational alerts, security notifications, and support communications.</p>
      <h3>Section 1.2. Marketing and Promotional Messages</h3>
      <p>Feature announcements, promotional offers, Founding Member updates, event-based marketing, and referral program information.</p>

      <h2>Article II: Consent</h2>
      <h3>Section 2.1. Opt-In Methods</h3>
      <p>Consent may be provided by: (a) checking the SMS consent checkbox during registration or booking; (b) texting START to our number; (c) providing your number through a form with clear disclosure; or (d) documented verbal consent.</p>
      <h3>Section 2.2. Consent Language</h3>
      <p><strong>Transactional checkbox:</strong></p>
      <blockquote>I consent to receive transactional text messages from Drive Exotiq at the phone number provided (e.g., booking confirmations, reminders, account alerts). Message frequency may vary. Message and data rates may apply. Reply HELP for help or STOP to opt out.</blockquote>
      <p><strong>Marketing checkbox:</strong></p>
      <blockquote>I consent to receive marketing and promotional text messages from Drive Exotiq at the phone number provided. Message frequency may vary. Message and data rates may apply. Reply HELP for help or STOP to opt out.</blockquote>
      <h3>Section 2.3. Not Required for Service</h3>
      <p>Consent is not required as a condition of purchasing any goods or services, booking a vehicle, or creating an account. Checkboxes are never pre-checked.</p>

      <h2>Article III: Message Frequency and Rates</h2>
      <p>Transactional: 1–5 messages per booking/event. Marketing: no more than 8 per month. Message and data rates may apply.</p>

      <h2>Article IV: Opt-Out</h2>
      <p>Reply <strong>STOP</strong> to any message. Or contact <a href="mailto:support@exotiq.ai">support@exotiq.ai</a> (operators) / <a href="mailto:support@driveexotiq.com">support@driveexotiq.com</a> (renters). Reply <strong>PROMO STOP</strong> to opt out of marketing only. Processed immediately via text, within 5 business days via other channels.</p>

      <h2>Article V: HELP</h2>
      <p>Reply <strong>HELP</strong> to any message, or contact <a href="mailto:support@exotiq.ai">support@exotiq.ai</a> / <a href="mailto:support@driveexotiq.com">support@driveexotiq.com</a>.</p>

      <h2>Article VI: Carriers and Eligibility</h2>
      <p>Supported by all major U.S. carriers (AT&amp;T, Verizon, T-Mobile, others). Carriers are not liable for delayed or undelivered messages. U.S. residents only, age 18+.</p>

      <h2>Article VII: SMS Platform Providers</h2>
      <table>
        <thead>
          <tr><th>Provider</th><th>Role</th><th>Data Processed</th></tr>
        </thead>
        <tbody>
          <tr><td>GoHighLevel</td><td>Primary SMS platform, CRM, A2P 10DLC</td><td>Phone numbers, messages, consent data</td></tr>
          <tr><td>Twilio</td><td>SMS delivery infrastructure</td><td>Phone numbers, message content</td></tr>
        </tbody>
      </table>

      <h2>Article VIII: AI Messages (Rari)</h2>
      <p>Rari may generate text messages regarding bookings. Initial messages include: "This message was sent by Rari, Drive Exotiq's AI concierge, on behalf of [Operator Name]." Operators using Rari for SMS are responsible for obtaining TCPA-compliant consent from recipients.</p>

      <h2>Article IX: Consent Records</h2>
      <p>We maintain consent records including date, time, method, IP address, and consent language version. Retained for at least five (5) years per TCPA, CTIA, and FCC requirements. We do not sell, rent, or share SMS consent or phone numbers for third-party marketing.</p>

      <h2>Contact</h2>
      <p><strong>Operators:</strong> <a href="mailto:support@exotiq.ai">support@exotiq.ai</a></p>
      <p><strong>Renters:</strong> <a href="mailto:support@driveexotiq.com">support@driveexotiq.com</a></p>
      <p><strong>Address:</strong> Exotiq Inc., 1001 S Main St #6709, Kalispell, MT 59901</p>
    </LegalPageLayout>
  );
};

export default Sms;
