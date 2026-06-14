import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const AcceptableUse = () => {
  return (
    <LegalPageLayout
      title="Acceptable Use Policy"
      subtitle="Standards of Conduct for the Exotiq Command Center"
      effectiveDate="January 1, 2026"
      lastUpdated="June 14, 2026"
    >
      <p>This Acceptable Use Policy ("AUP") governs your use of the Exotiq Command Center platform and the Drive Exotiq marketplace (collectively, the "Platform"). This AUP is incorporated into and forms part of the Terms and Conditions.</p>
      <p>Violation of this AUP may result in suspension or termination of your account at Exotiq's sole discretion.</p>

      <h2>Article I: General Standards</h2>
      <p>You agree to: (a) operate your fleet in compliance with all applicable laws; (b) maintain valid insurance for all vehicles; (c) provide accurate information; and (d) respect the rights of renters, Vehicle Partners, and other users.</p>

      <h2>Article II: Prohibited Uses</h2>
      <h3>Section 2.1. Illegal Activity</h3>
      <p>You may not use the Platform to: (a) facilitate fraud, money laundering, tax evasion, or export control violations; (b) operate unregistered, uninsured, or illegally modified vehicles; (c) rent to individuals who do not meet legal driving requirements; or (d) circumvent rental licensing or permitting requirements.</p>
      <h3>Section 2.2. Platform Abuse</h3>
      <p>You may not: (a) gain unauthorized access to the Platform or other accounts; (b) interfere with Platform infrastructure; (c) use unauthorized automated tools; (d) reverse engineer Platform components; or (e) exceed API rate limits.</p>
      <h3>Section 2.3. Data Misuse</h3>
      <p>You may not: (a) use renter data for unrelated purposes; (b) sell or distribute renter data without consent; (c) upload malicious code; or (d) misuse Vault storage.</p>
      <h3>Section 2.4. AI Service Abuse</h3>
      <p>You may not: (a) manipulate AI recommendations with artificial data; (b) use FleetCopilot/Rari to generate harmful content; (c) misrepresent AI outputs as human analysis; or (d) attempt to extract or reverse engineer AI models.</p>
      <h3>Section 2.5. Marketplace Abuse (Drive Exotiq)</h3>
      <p>You may not: (a) list vehicles you don't own or have authority to rent; (b) post misleading listings; (c) create fake reviews; (d) engage in anti-competitive price manipulation; or (e) discriminate against renters based on any protected characteristic.</p>
      <h3>Section 2.6. Financial Misconduct</h3>
      <p>You may not: (a) submit fraudulent payment information; (b) manipulate Margin data; (c) facilitate payments for illegal activity; or (d) circumvent Stripe's requirements.</p>

      <h2>Article III: Vehicle and Safety Standards</h2>
      <p>You agree to maintain all vehicles in safe, roadworthy condition with current registration, insurance, and compliance with safety recalls. Exotiq may remove listings or suspend accounts where safety concerns are identified.</p>

      <h2>Article IV: Content Standards</h2>
      <p>All content must not: (a) be unlawful, threatening, or defamatory; (b) infringe intellectual property rights; (c) contain unauthorized personal information; or (d) include false or misleading claims.</p>

      <h2>Article V: Enforcement</h2>
      <p>Upon determining a violation, Exotiq may: (a) issue a warning; (b) suspend features; (c) suspend your account; (d) terminate your account; (e) remove content; or (f) report to law enforcement. Appeals may be submitted to <a href="mailto:compliance@exotiq.ai">compliance@exotiq.ai</a> within fifteen (15) days.</p>

      <h2>Contact</h2>
      <p><strong>Email:</strong> <a href="mailto:compliance@exotiq.ai">compliance@exotiq.ai</a></p>
      <p><strong>Address:</strong> Exotiq Inc., 1001 S Main St #6709, Kalispell, MT 59901</p>
    </LegalPageLayout>
  );
};

export default AcceptableUse;
