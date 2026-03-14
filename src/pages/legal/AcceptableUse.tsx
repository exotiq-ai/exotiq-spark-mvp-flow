import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const AcceptableUse = () => {
  return (
    <LegalPageLayout
      title="Acceptable Use Policy"
      subtitle="Exotiq Command Center Platform"
      effectiveDate="January 1, 2026"
      lastUpdated="March 2026"
    >
      <p>
        This Acceptable Use Policy ("AUP") governs your use of the Exotiq Command Center platform and the Drive Exotiq marketplace (collectively, the "Platform"). This AUP is incorporated into and forms part of the Terms and Conditions (the "Agreement") between you and Exotiq Inc. Capitalized terms not defined herein shall have the meanings ascribed to them in the Agreement.
      </p>
      <p>
        Violation of this AUP may result in suspension or termination of your account at Exotiq's sole discretion, in addition to any other remedies available under the Agreement or applicable law.
      </p>

      <h1>1. General Standards of Conduct</h1>
      <p>You agree to use the Platform only for lawful purposes and in compliance with these standards. You shall: (a) operate your fleet in compliance with all applicable federal, state, and local laws and regulations; (b) maintain valid insurance coverage for all vehicles managed through the Platform; (c) provide accurate and truthful information in all Platform interactions; and (d) respect the rights of renters, Vehicle Partners, and other Platform users.</p>

      <h1>2. Prohibited Uses</h1>

      <h2>2.1 Illegal Activity</h2>
      <p>You shall not use the Platform to: (a) facilitate, promote, or conceal any illegal activity, including but not limited to fraud, money laundering, tax evasion, or violation of export controls; (b) operate unregistered, uninsured, or illegally modified vehicles; (c) rent vehicles to individuals who do not meet applicable legal driving requirements; or (d) circumvent rental licensing or permitting requirements.</p>

      <h2>2.2 Platform Abuse</h2>
      <p>You shall not: (a) attempt to gain unauthorized access to the Platform, other user accounts, or Exotiq's systems or networks; (b) interfere with or disrupt the Platform's infrastructure, security features, or other users' access; (c) use automated tools, bots, or scripts to access the Platform except through approved API endpoints; (d) reverse engineer, decompile, disassemble, or attempt to extract the source code of any Platform component; or (e) exceed documented API rate limits or engage in usage patterns that degrade Platform performance for other users.</p>

      <h2>2.3 Data Misuse</h2>
      <p>You shall not: (a) use renter personal information obtained through the Platform for any purpose unrelated to your rental operations; (b) share, sell, rent, or distribute renter data to third parties without obtaining proper consent; (c) upload malicious files, viruses, malware, or other harmful code to the Platform; or (d) store data in Vault that is unrelated to your fleet operations for the purpose of circumventing storage limitations.</p>

      <h2>2.4 AI Service Abuse</h2>
      <p>You shall not: (a) attempt to manipulate AI pricing recommendations through the submission of artificial, falsified, or misleading data inputs; (b) use FleetCopilot or Rari to generate content that is harassing, threatening, defamatory, discriminatory, or otherwise harmful; (c) misrepresent AI-generated outputs as independently produced human analysis or professional advice; or (d) attempt to extract, replicate, or reverse engineer Exotiq's AI models, training data, algorithms, or model weights.</p>

      <h2>2.5 Marketplace Abuse (Drive Exotiq)</h2>
      <p>You shall not: (a) list vehicles you do not own or have legal authorization to rent; (b) post misleading, inaccurate, or deceptive vehicle descriptions, photographs, or pricing on Drive Exotiq; (c) create, solicit, or publish fake reviews or ratings; (d) engage in price manipulation, bid rigging, or anti-competitive coordination with other operators; or (e) discriminate against renters on the basis of race, ethnicity, national origin, religion, sex, gender identity, sexual orientation, disability, or any other characteristic protected by applicable law.</p>

      <h2>2.6 Financial Misconduct</h2>
      <p>You shall not: (a) submit fraudulent payment information or process unauthorized transactions; (b) manipulate financial data within the Margin module to misrepresent business performance to Vehicle Partners, lenders, investors, or other third parties; (c) use the Platform to facilitate payments for illegal goods or services; or (d) circumvent or attempt to circumvent Stripe's payment processing requirements or terms of service.</p>

      <h1>3. Vehicle and Safety Standards</h1>
      <p>Customers operating fleets through the Platform agree to: (a) maintain all listed vehicles in safe, roadworthy condition; (b) maintain current registration, inspection, and insurance documentation for all vehicles; (c) provide accurate mileage, maintenance, and condition records; and (d) comply with all applicable safety recalls and manufacturer service bulletins in a timely manner.</p>
      <p>Exotiq reserves the right to remove vehicle listings or suspend accounts where credible safety concerns are identified, even in the absence of a specific violation of this AUP.</p>

      <h1>4. Content Standards</h1>
      <p>All content you upload, transmit, or display through the Platform must not: (a) contain unlawful, threatening, abusive, harassing, defamatory, libelous, or obscene material; (b) infringe any intellectual property rights of any third party; (c) contain personally identifiable information of any individual without that individual's consent; or (d) include false, misleading, or deceptive claims about your vehicles, services, or business.</p>

      <h1>5. Reporting Violations</h1>
      <p>If you become aware of any actual or suspected violation of this AUP, please report it to <a href="mailto:compliance@exotiq.ai">compliance@exotiq.ai</a>. Exotiq will investigate all credible reports and take appropriate action.</p>

      <h1>6. Enforcement</h1>

      <h2>6.1 Investigation</h2>
      <p>Exotiq may investigate suspected AUP violations using information available to it, including Platform activity logs, transaction records, and user reports.</p>

      <h2>6.2 Remedies</h2>
      <p>Upon determining that an AUP violation has occurred, Exotiq may, in its sole discretion: (a) issue a written warning; (b) temporarily suspend your access to specific features or modules; (c) suspend your account pending investigation and resolution; (d) permanently terminate your account; (e) remove content or listings that violate this AUP; or (f) report violations to appropriate law enforcement or regulatory authorities.</p>

      <h2>6.3 Appeals</h2>
      <p>If your account is suspended or terminated for an AUP violation, you may appeal the decision by submitting a written appeal to <a href="mailto:compliance@exotiq.ai">compliance@exotiq.ai</a> within fifteen (15) calendar days of receiving notice. Appeals will be reviewed by a designated senior representative, and a written decision will be communicated within ten (10) business days.</p>

      <h1>7. Amendments</h1>
      <p>Exotiq reserves the right to amend this AUP at any time. Material changes will be communicated with not less than thirty (30) days prior notice via email. Your continued use of the Platform following the effective date of any amendment shall constitute your acceptance of the revised AUP.</p>

      <p className="mt-8 text-sm">
        For questions regarding this AUP, contact: <a href="mailto:compliance@exotiq.ai">compliance@exotiq.ai</a>
      </p>
      <p className="text-sm">Exotiq Inc., a Delaware C-Corporation</p>
    </LegalPageLayout>
  );
};

export default AcceptableUse;
