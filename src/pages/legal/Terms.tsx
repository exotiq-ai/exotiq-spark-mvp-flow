import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const Terms = () => {
  return (
    <LegalPageLayout
      title="Terms and Conditions"
      subtitle="Exotiq Command Center Platform Agreement"
      effectiveDate="January 1, 2026"
      lastUpdated="June 14, 2026"
    >
      <p>These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("Customer," "you," or "your") and Exotiq Inc., a Delaware C-Corporation ("Exotiq," "we," "us," or "our"), governing your access to and use of the Exotiq Command Center platform, including all associated modules, tools, APIs, AI-powered features, and the Drive Exotiq marketplace (collectively, the "Platform").</p>
      <p>By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you are entering into these Terms on behalf of a business entity, you represent that you have the authority to bind that entity.</p>

      <h2>Article I: Definitions</h2>
      <p><strong>"Command Center"</strong> means the Exotiq SaaS platform accessible at app.exotiq.ai, including all Operations and Intelligence modules.</p>
      <p><strong>"Customer Data"</strong> means all data, content, files, documents, vehicle information, booking records, financial records, renter information, and other materials that you upload to, create within, or transmit through the Platform.</p>
      <p><strong>"AI Services"</strong> means the artificial intelligence and machine learning features of the Platform, including but not limited to MotorIQ (dynamic pricing), FleetCopilot (conversational AI operations assistant), Rari (voice agent), Vault (document intelligence), and Margin (financial intelligence).</p>
      <p><strong>"Drive Exotiq"</strong> means the renter-facing online travel agency marketplace operated by Exotiq at driveexotiq.com.</p>
      <p><strong>"Vehicle Partner"</strong> means a vehicle owner who consigns one or more vehicles to a Customer for rental operations managed through the Platform.</p>
      <p><strong>"Founding Member"</strong> means a Customer who subscribed to the Platform during the founding membership period and received lifetime locked pricing.</p>
      <p><strong>"Subscription Plan"</strong> means the specific tier (Starter, Professional, Business, or Enterprise) selected by the Customer, as described in Article V.</p>
      <p><strong>"Third-Party Services"</strong> means services integrated with or accessed through the Platform that are provided by entities other than Exotiq, including but not limited to Stripe, ElevenLabs, Google (Gemini API), telematics providers, and insurance partners.</p>

      <h2>Article II: Platform Description and Scope</h2>
      <h3>Section 2.1. Command Center Modules</h3>
      <p>The Platform provides the following modules, subject to your Subscription Plan:</p>
      <h4>(a) Operations Modules</h4>
      <ul>
        <li><strong>Dashboard.</strong> Fleet status overview and key performance metrics.</li>
        <li><strong>Bookings.</strong> Reservation lifecycle management, calendar, payment processing, and guest CRM.</li>
        <li><strong>Fleet.</strong> Vehicle inventory management, status tracking, telematics integration, and maintenance scheduling.</li>
        <li><strong>Pulse.</strong> Operational health monitoring, utilization analytics, and performance tracking.</li>
        <li><strong>Margin.</strong> Financial intelligence including revenue dashboards, expense tracking, vehicle-level profitability, and partner revenue splits.</li>
      </ul>
      <h4>(b) Intelligence Modules</h4>
      <ul>
        <li><strong>MotorIQ.</strong> AI-powered dynamic pricing engine with demand analysis, competitor monitoring, event-driven pricing adjustments, and revenue optimization recommendations.</li>
        <li><strong>FleetCopilot.</strong> AI conversational assistant for fleet operations, powered by the Rari voice agent, enabling natural language fleet management and multi-vehicle operations.</li>
        <li><strong>Vault.</strong> Compliance management, document storage, e-signature capture, expiration tracking, and regulatory deadline monitoring.</li>
      </ul>

      <h3>Section 2.2. Drive Exotiq Marketplace</h3>
      <p>Subject to separate marketplace terms, Customers may list vehicles on the Drive Exotiq marketplace. The fee structure is as follows:</p>
      <ol type="a">
        <li>10% renter-side fee (added to booking total, visible to renter);</li>
        <li>10% host-side fee (deducted from Customer gross revenue);</li>
        <li>20% total platform fee; and</li>
        <li>Direct bookings via Customer-specific links: 0% platform fee.</li>
      </ol>

      <h3>Section 2.3. Module Availability</h3>
      <p>Not all modules are available on all Subscription Plans. Feature access is determined by your selected tier as described in Article V. Exotiq reserves the right to modify, add, or retire modules with reasonable notice.</p>

      <h2>Article III: Account Registration and Security</h2>
      <h3>Section 3.1. Account Requirements</h3>
      <p>To use the Platform, you must: (a) provide accurate, current, and complete registration information; (b) maintain the security of your account credentials; (c) promptly update your information if it changes; and (d) accept all risks of unauthorized access to your account.</p>
      <h3>Section 3.2. Authorized Users</h3>
      <p>You are responsible for all activity occurring under your account, including activity by employees, contractors, Vehicle Partners, and any other individuals you authorize to access the Platform. You must ensure all authorized users comply with these Terms.</p>
      <h3>Section 3.3. Account Security</h3>
      <p>You must immediately notify Exotiq at <a href="mailto:security@exotiq.ai">security@exotiq.ai</a> if you become aware of any unauthorized access to or use of your account. Exotiq will not be liable for any loss arising from unauthorized use of your account where you have failed to maintain adequate security of your credentials.</p>

      <h2>Article IV: Customer Data Ownership and Rights</h2>
      <h3>Section 4.1. Ownership</h3>
      <p>You retain all rights, title, and interest in your Customer Data. Exotiq does not claim ownership of any Customer Data.</p>
      <h3>Section 4.2. License Grant to Exotiq</h3>
      <p>You grant Exotiq a limited, non-exclusive, worldwide license to access, use, process, and display your Customer Data solely for the purpose of: (a) providing and improving the Platform; (b) generating AI-driven insights, pricing recommendations, and analytics for your account; and (c) providing technical support. This license terminates when your subscription ends, subject to Article XIV (Data Retention).</p>
      <h3>Section 4.3. Aggregated and Anonymized Data</h3>
      <p>Exotiq may create and use aggregated, anonymized, or de-identified data derived from Customer Data for product improvement, benchmarking, and market analysis. Such data will not identify you or any individual renter. This aggregated data may be retained and used after termination of your account.</p>
      <h3>Section 4.4. Data Portability</h3>
      <p>Upon request, Exotiq will provide you with an export of your Customer Data in a standard machine-readable format (CSV or JSON) within thirty (30) business days. One data export per calendar year is included at no additional charge. Additional exports may be subject to a reasonable processing fee.</p>
      <h3>Section 4.5. Renter Data</h3>
      <p>Renter information collected through the Platform (names, contact information, identification documents, rental history) is your Customer Data and is subject to your own privacy policy and applicable law. You are solely responsible for obtaining any required consents from renters for the collection, storage, and processing of their personal information through the Platform.</p>

      <h2>Article V: Subscription Plans and Pricing</h2>
      <h3>Section 5.1. Tier Structure</h3>
      <table>
        <thead>
          <tr><th>Tier</th><th>Monthly Price</th><th>Fleet Size</th><th>Key Features</th></tr>
        </thead>
        <tbody>
          <tr><td>Starter</td><td>$29/vehicle/month (min $79)</td><td>1-10 vehicles</td><td>7-day forecasting, basic AI, email support</td></tr>
          <tr><td>Professional</td><td>$399/month (flat)</td><td>5-25 vehicles</td><td>30-day forecasting, full AI suite, API access, chat support</td></tr>
          <tr><td>Business</td><td>$899/month (flat)</td><td>26-75 vehicles</td><td>90-day forecasting, white-label options, phone support</td></tr>
          <tr><td>Enterprise</td><td>$1,799/month (flat)</td><td>76-150 vehicles</td><td>365-day forecasting, custom AI models, 24/7 support</td></tr>
        </tbody>
      </table>

      <h3>Section 5.2. Overage Pricing</h3>
      <p>If your active vehicle count exceeds the maximum for your Subscription Plan, overage fees apply per additional vehicle per month: Professional tier: $22/vehicle; Business tier: $18/vehicle; Enterprise tier: $15/vehicle. Overage fees are billed monthly in arrears.</p>
      <h3>Section 5.3. Annual Prepayment</h3>
      <p>Customers who prepay annually receive a discount equivalent to two (2) months of their Subscription Plan. Annual prepayments are non-refundable except as required by applicable law.</p>
      <h3>Section 5.4. Founding Member Pricing</h3>
      <p>Customers who subscribed during the Founding Member enrollment period receive their subscription rate locked for the lifetime of their continuous subscription. Founding Member pricing is forfeited if the subscription lapses for more than thirty (30) days.</p>
      <h3>Section 5.5. Price Changes</h3>
      <p>Exotiq may adjust pricing for non-Founding Member accounts with sixty (60) days written notice. Price changes take effect at the start of the next billing cycle following the notice period. Founding Member pricing is exempt from price increases for the duration of continuous enrollment.</p>
      <h3>Section 5.6. Taxes</h3>
      <p>All prices are exclusive of applicable taxes. You are responsible for all taxes, duties, and government assessments associated with your use of the Platform, excluding taxes based on Exotiq's net income.</p>

      <h2>Article VI: Payment Terms</h2>
      <h3>Section 6.1. Payment Processing</h3>
      <p>All payments are processed through Stripe, Inc. ("Stripe"). By subscribing to the Platform, you agree to Stripe's terms of service. Exotiq does not directly store credit card numbers or banking credentials.</p>
      <h3>Section 6.2. Billing Cycle</h3>
      <p>Monthly subscriptions are billed on the anniversary of your subscription start date. Annual subscriptions are billed on the annual anniversary. Overage fees are billed on the first business day of the following month.</p>
      <h3>Section 6.3. Failed Payments</h3>
      <p>If a payment fails, Exotiq will: (a) notify you via email; (b) attempt to process payment again after three (3) business days; (c) attempt a final time after seven (7) business days. If all three attempts fail, your account may be suspended until payment is received. Data will be retained for thirty (30) days after suspension, after which it may be permanently deleted.</p>
      <h3>Section 6.4. Refunds</h3>
      <p>Monthly subscriptions: no refunds for partial months. Annual subscriptions: pro-rated refunds are available within the first thirty (30) days. After thirty (30) days, annual subscriptions are non-refundable. Drive Exotiq marketplace fees are non-refundable once a booking has been completed.</p>

      <h2>Article VII: AI Services — Disclaimers and Limitations</h2>
      <h3>Section 7.1. Advisory Nature of AI Recommendations</h3>
      <p>The AI Services, including but not limited to MotorIQ pricing recommendations, FleetCopilot operational suggestions, and Margin financial analytics, are decision-support tools. All AI-generated outputs, recommendations, forecasts, and analyses are advisory in nature and do not constitute guarantees of specific outcomes.</p>
      <h3>Section 7.2. No Guarantee of Revenue Outcomes</h3>
      <p>While Exotiq's AI pricing engine has demonstrated revenue improvements of 18-35% in validation testing, these results are not guaranteed for any specific fleet, market, or time period. Actual results depend on factors including but not limited to market conditions, fleet composition, vehicle condition, operator responsiveness, local competition, and seasonal demand patterns. Past performance metrics are illustrative, not predictive.</p>
      <h3>Section 7.3. Human Oversight Requirement</h3>
      <p>You acknowledge and agree that: (a) AI-generated pricing recommendations should be reviewed before application; (b) you remain solely responsible for all pricing, operational, and business decisions made using AI outputs; (c) AI models may produce inaccurate, incomplete, or suboptimal recommendations; and (d) you will not rely exclusively on AI outputs without exercising independent business judgment.</p>
      <h3>Section 7.4. AI Model Updates</h3>
      <p>Exotiq continuously improves its AI models. Model updates, retraining, or algorithm changes may result in different recommendations for identical scenarios. Exotiq will use commercially reasonable efforts to maintain or improve recommendation quality but does not guarantee consistency between model versions.</p>
      <h3>Section 7.5. Voice AI (Rari/FleetCopilot)</h3>
      <p>The Rari voice agent is powered by ElevenLabs. Voice interactions may be processed by ElevenLabs' infrastructure pursuant to their terms of service. Exotiq does not guarantee uninterrupted availability of voice features, which depend on third-party service uptime. Voice commands that result in pricing changes, booking modifications, or operational actions are executed at your direction and responsibility.</p>
      <h3>Section 7.6. Demand Forecasting</h3>
      <p>Demand forecasting features utilize the Google Gemini API for event data and trend analysis. Forecasts are probabilistic estimates, not certainties. Actual demand may differ materially from forecasted demand due to unpredictable market events, weather, regulatory changes, or other external factors.</p>

      <h2>Article VIII: Vault — Document and Compliance Terms</h2>
      <h3>Section 8.1. No Legal Document Templates</h3>
      <p>Exotiq does not provide, draft, review, or warrant any rental agreement templates, liability waivers, or legal documents. You are solely responsible for the content, accuracy, legal sufficiency, and enforceability of all documents stored in or processed through Vault. Exotiq strongly recommends that you consult qualified legal counsel for the preparation and review of your rental agreements and compliance documentation.</p>
      <h3>Section 8.2. Electronic Signatures</h3>
      <p>Vault provides built-in canvas signature capture functionality. Documents signed through Vault receive a human-readable Exotiq Document Reference (EXQ-DOC-YYYY-NNNNN). While Exotiq designs its e-signature functionality to comply with the Electronic Signatures in Global and National Commerce Act (ESIGN Act) and the Uniform Electronic Transactions Act (UETA), Exotiq does not guarantee the legal enforceability of any electronically signed document in any jurisdiction. You are responsible for ensuring that electronic signatures meet the legal requirements applicable to your specific use case and jurisdiction.</p>
      <h3>Section 8.3. Compliance Monitoring</h3>
      <p>Vault's compliance tracking features (insurance expiration alerts, registration monitoring, inspection scheduling) are provided as operational aids. Exotiq does not guarantee the accuracy or completeness of compliance alerts and does not assume responsibility for any compliance failures. You remain solely responsible for meeting all applicable regulatory, licensing, insurance, and legal requirements for your fleet operations.</p>
      <h3>Section 8.4. Document Storage</h3>
      <p>Documents uploaded to Vault are stored with encryption at rest. Exotiq maintains commercially reasonable security measures but does not guarantee that documents will be free from loss, corruption, or unauthorized access. You should maintain independent backups of all critical documents.</p>

      <h2>Article IX: Margin — Financial Intelligence Terms</h2>
      <h3>Section 9.1. Financial Data Sources</h3>
      <p>Margin derives financial data primarily from Stripe transaction records synchronized to the Exotiq database. Exotiq does not perform independent audits of financial data. The accuracy of Margin's reports and analytics depends on the accuracy of underlying Stripe records and any manually entered data (expenses, partner splits, cash payments).</p>
      <h3>Section 9.2. Not Financial Advice</h3>
      <p>Margin's reports, dashboards, profitability analyses, and forecasts are informational tools. They do not constitute financial, tax, investment, or accounting advice. You should consult qualified financial and tax professionals for all financial and tax-related decisions. Exotiq is not a registered financial advisor, accountant, or tax preparer.</p>
      <h3>Section 9.3. Vehicle Partner Splits</h3>
      <p>If you configure vehicle partner revenue splits (percentage or flat-fee structures) within Margin, you are solely responsible for the accuracy of those configurations and for all payment obligations to your Vehicle Partners. Exotiq calculates and displays split amounts based on your configurations but does not execute, guarantee, or assume liability for partner payouts.</p>

      <h2>Article X: Third-Party Services and Integrations</h2>
      <h3>Section 10.1. Stripe Connect</h3>
      <p>Payment processing is provided by Stripe pursuant to Stripe's terms of service and privacy policy. You must maintain an active Stripe Connect account to process payments through the Platform. Exotiq is not responsible for Stripe's service availability, processing errors, held funds, or compliance requirements.</p>
      <h3>Section 10.2. Telematics Providers</h3>
      <p>The Platform integrates with third-party telematics providers (Bouncie, Verizon Connect, Zubie, and others). Telematics data accuracy, availability, and latency are determined by your telematics provider. Exotiq does not guarantee the accuracy of GPS, diagnostic, or vehicle health data received from telematics systems.</p>
      <h3>Section 10.3. AI Infrastructure Providers</h3>
      <p>The Platform utilizes services from ElevenLabs (voice AI), Google (Gemini API), OpenAI, and Anthropic (Claude) for various AI features. Your use of the Platform constitutes acknowledgment that certain data may be processed by these providers pursuant to their respective terms of service and privacy policies. Exotiq selects and configures these providers to align with its Privacy Policy but does not control their independent data practices.</p>
      <h3>Section 10.4. Third-Party Service Failures</h3>
      <p>Exotiq is not liable for any Platform feature degradation, service interruption, or data processing failure caused by the unavailability, error, or policy change of any Third-Party Service. Exotiq will use commercially reasonable efforts to notify you of known third-party disruptions.</p>

      <h2>Article XI: Intellectual Property</h2>
      <h3>Section 11.1. Exotiq's Intellectual Property</h3>
      <p>The Platform, including its source code, algorithms, AI models, user interface, documentation, APIs, brand elements (including the names Exotiq, MotorIQ, Pulse, Margin, FleetCopilot, Vault, Rari, Drive Exotiq, and Command Center), and all related intellectual property are owned exclusively by Exotiq Inc. Your subscription grants you a limited, non-exclusive, non-transferable, revocable license to use the Platform during your subscription term.</p>
      <h3>Section 11.2. Restrictions</h3>
      <p>You may not: (a) reverse engineer, decompile, or disassemble any part of the Platform; (b) copy, modify, or create derivative works of the Platform; (c) sublicense, sell, resell, or distribute access to the Platform; (d) use the Platform to build a competitive product or service; (e) remove or alter any proprietary notices; or (f) use automated tools to scrape, crawl, or extract data from the Platform beyond approved API usage.</p>
      <h3>Section 11.3. Feedback</h3>
      <p>If you provide feedback, feature requests, or suggestions regarding the Platform, you grant Exotiq an irrevocable, perpetual, royalty-free license to use, modify, and incorporate such feedback into the Platform without obligation to you.</p>

      <h2>Article XII: Warranties and Disclaimers</h2>
      <h3>Section 12.1. Limited Warranty</h3>
      <p>Exotiq warrants that: (a) the Platform will perform materially in accordance with its published documentation during your subscription term; and (b) Exotiq will provide the Platform using commercially reasonable care and skill.</p>
      <h3>Section 12.2. Disclaimer of Warranties</h3>
      <p className="uppercase">EXCEPT AS EXPRESSLY SET FORTH IN SECTION 12.1, THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE." EXOTIQ DISCLAIMS ALL OTHER WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. EXOTIQ DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ALL DEFECTS WILL BE CORRECTED.</p>
      <h3>Section 12.3. AI-Specific Disclaimers</h3>
      <p className="uppercase">WITHOUT LIMITING SECTION 12.2, EXOTIQ SPECIFICALLY DISCLAIMS ANY WARRANTY REGARDING: (A) THE ACCURACY, COMPLETENESS, OR RELIABILITY OF AI-GENERATED PRICING RECOMMENDATIONS, FORECASTS, OR ANALYSES; (B) THE ACHIEVEMENT OF ANY SPECIFIC REVENUE, UTILIZATION, OR FINANCIAL OUTCOME; (C) THE CONTINUOUS AVAILABILITY OF VOICE AI FEATURES; AND (D) THE LEGAL ENFORCEABILITY OF ELECTRONICALLY SIGNED DOCUMENTS IN ANY JURISDICTION.</p>

      <h2>Article XIII: Limitation of Liability</h2>
      <h3>Section 13.1. Exclusion of Consequential Damages</h3>
      <p className="uppercase">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOST PROFITS, LOST REVENUE, LOST DATA, BUSINESS INTERRUPTION, OR COST OF SUBSTITUTE SERVICES, REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
      <h3>Section 13.2. Cap on Liability</h3>
      <p className="uppercase">EXOTIQ'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES PAID BY YOU TO EXOTIQ DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (B) ONE THOUSAND DOLLARS ($1,000).</p>
      <h3>Section 13.3. Exceptions</h3>
      <p>The limitations in Sections 13.1 and 13.2 shall not apply to: (a) your payment obligations; (b) either party's indemnification obligations; (c) either party's breach of confidentiality obligations; or (d) liability that cannot be limited by applicable law.</p>
      <h3>Section 13.4. Vehicle and Rental Liability</h3>
      <p>Exotiq is a software platform provider. Exotiq has no ownership interest in, custody of, or physical control over any vehicles managed through the Platform. Exotiq is not liable for any property damage, personal injury, theft, accident, or any other loss arising from the rental, operation, or use of any vehicle, regardless of whether the rental was facilitated through the Platform or the Drive Exotiq marketplace.</p>

      <h2>Article XIV: Term, Termination, and Data Retention</h2>
      <h3>Section 14.1. Term</h3>
      <p>These Terms are effective from the date you first access the Platform and continue for the duration of your active subscription.</p>
      <h3>Section 14.2. Termination by Customer</h3>
      <p>You may cancel your subscription at any time through the Platform's account settings. Cancellation takes effect at the end of your current billing period. You will not receive a refund for any remaining portion of a prepaid billing period, except as provided in Section 6.4.</p>
      <h3>Section 14.3. Termination by Exotiq</h3>
      <p>Exotiq may suspend or terminate your account if: (a) you breach these Terms or the Acceptable Use Policy; (b) your payment is delinquent for more than thirty (30) days; (c) you engage in activity that threatens the security, integrity, or performance of the Platform; or (d) required by law or regulation. Exotiq will provide reasonable notice before termination except where immediate action is necessary to prevent harm.</p>
      <h3>Section 14.4. Data Retention After Termination</h3>
      <p>Following termination: (a) your Customer Data will be available for export for thirty (30) days; (b) after thirty (30) days, your Customer Data will be permanently deleted from active systems; (c) backup copies may persist in encrypted backups for up to ninety (90) additional days before permanent deletion; and (d) aggregated, anonymized data may be retained indefinitely.</p>
      <h3>Section 14.5. Survival</h3>
      <p>The following Articles survive termination: IV (Data Ownership), VII (AI Disclaimers), XI (Intellectual Property), XII (Warranties and Disclaimers), XIII (Limitation of Liability), XV (Indemnification), XVII (Governing Law), and XVIII (Dispute Resolution).</p>

      <h2>Article XV: Indemnification</h2>
      <h3>Section 15.1. Indemnification by Customer</h3>
      <p>You agree to indemnify, defend, and hold harmless Exotiq, its officers, directors, employees, and agents from and against all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from: (a) your use of the Platform; (b) your breach of these Terms; (c) your violation of applicable law; (d) any rental transaction facilitated through the Platform; (e) the content or legal sufficiency of your rental agreements or documents stored in Vault; (f) any claim by a renter, Vehicle Partner, or third party related to your fleet operations; or (g) your failure to comply with applicable regulations, licensing, or insurance requirements.</p>
      <h3>Section 15.2. Indemnification by Exotiq</h3>
      <p>Exotiq will indemnify and defend you against third-party claims alleging that the Platform infringes a valid patent, copyright, or trademark, provided that: (a) you promptly notify Exotiq of the claim; (b) you grant Exotiq sole control of the defense; and (c) you provide reasonable cooperation. This indemnity does not cover claims arising from your modifications to the Platform, use of the Platform in combination with non-Exotiq products, or use of a non-current version of the Platform.</p>

      <h2>Article XVI: Confidentiality</h2>
      <p>Each party agrees to maintain the confidentiality of the other party's proprietary information disclosed in connection with these Terms. Confidential information does not include information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was lawfully known before disclosure; (c) is independently developed without use of the disclosing party's information; or (d) is rightfully obtained from a third party without restriction.</p>

      <h2>Article XVII: Governing Law</h2>
      <p>These Terms are governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of law principles. The United Nations Convention on Contracts for the International Sale of Goods does not apply.</p>

      <h2>Article XVIII: Dispute Resolution</h2>
      <h3>Section 18.1. Informal Resolution</h3>
      <p>Before initiating any formal dispute resolution proceeding, you agree to first contact Exotiq at <a href="mailto:legal@exotiq.ai">legal@exotiq.ai</a> and attempt to resolve the dispute informally for at least thirty (30) days.</p>
      <h3>Section 18.2. Arbitration</h3>
      <p>Any dispute not resolved informally shall be resolved by binding arbitration administered by the American Arbitration Association ("AAA") under its Commercial Arbitration Rules. The arbitration shall be conducted in the State of Delaware by a single arbitrator. The arbitrator's decision shall be final and binding.</p>
      <h3>Section 18.3. Class Action Waiver</h3>
      <p className="uppercase">YOU AND EXOTIQ AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.</p>
      <h3>Section 18.4. Exceptions</h3>
      <p>Either party may seek injunctive or equitable relief in any court of competent jurisdiction to protect its intellectual property rights or confidential information without waiving the right to arbitration.</p>

      <h2>Article XIX: General Provisions</h2>
      <h3>Section 19.1. Entire Agreement</h3>
      <p>These Terms, together with the Privacy Policy, Acceptable Use Policy, Data Processing Agreement, and any Order Forms or Statements of Work, constitute the entire agreement between you and Exotiq.</p>
      <h3>Section 19.2. Severability</h3>
      <p>If any provision of these Terms is held unenforceable, the remaining provisions continue in full force and effect.</p>
      <h3>Section 19.3. Waiver</h3>
      <p>Failure to enforce any provision of these Terms does not constitute a waiver of that provision or any other provision.</p>
      <h3>Section 19.4. Assignment</h3>
      <p>You may not assign or transfer these Terms without Exotiq's prior written consent. Exotiq may assign these Terms in connection with a merger, acquisition, reorganization, or sale of substantially all of its assets.</p>
      <h3>Section 19.5. Force Majeure</h3>
      <p>Neither party shall be liable for delays or failures in performance resulting from causes beyond its reasonable control, including but not limited to acts of God, natural disasters, pandemics, government actions, labor disputes, internet disruptions, or failures of Third-Party Services.</p>
      <h3>Section 19.6. Notices</h3>
      <p>All notices under these Terms must be in writing and delivered to: (a) Exotiq: <a href="mailto:legal@exotiq.ai">legal@exotiq.ai</a>; (b) Customer: the email address associated with your account.</p>
      <h3>Section 19.7. Relationship of Parties</h3>
      <p>The parties are independent contractors. Nothing in these Terms creates a partnership, joint venture, employment, or agency relationship.</p>
      <h3>Section 19.8. Amendments</h3>
      <p>Exotiq may update these Terms by posting revised Terms on the Platform and providing thirty (30) days notice via email. Continued use of the Platform after the effective date constitutes acceptance. Material changes to arbitration or liability provisions require affirmative consent.</p>

      <h2>Contact</h2>
      <p>For questions about these Terms: <a href="mailto:legal@exotiq.ai">legal@exotiq.ai</a></p>
      <p><strong>Address:</strong> Exotiq Inc., 1001 S Main St #6709, Kalispell, MT 59901</p>
    </LegalPageLayout>
  );
};

export default Terms;
