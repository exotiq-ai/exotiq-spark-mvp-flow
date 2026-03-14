import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

const Terms = () => {
  return (
    <LegalPageLayout
      title="Terms and Conditions"
      subtitle="Exotiq Command Center Platform Agreement"
      effectiveDate="January 1, 2026"
      lastUpdated="March 2026"
    >
      <p>
        These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("Customer," "you," or "your") and Exotiq Inc., a Delaware C-Corporation ("Exotiq," "we," "us," or "our"), governing your access to and use of the Exotiq Command Center platform, including all associated modules, tools, APIs, AI-powered features, and the Drive Exotiq marketplace (collectively, the "Platform").
      </p>
      <p>
        By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you are entering into these Terms on behalf of a business entity, you represent that you have the authority to bind that entity.
      </p>

      <h1>1. Definitions</h1>
      <p>The following definitions apply throughout these Terms and all related policy documents:</p>
      <ul>
        <li><strong>"Command Center"</strong> means the Exotiq SaaS platform accessible at app.exotiq.ai, including all Operations and Intelligence modules.</li>
        <li><strong>"Customer Data"</strong> means all data, content, files, documents, vehicle information, booking records, financial records, renter information, and other materials that you upload to, create within, or transmit through the Platform.</li>
        <li><strong>"AI Services"</strong> means the artificial intelligence and machine learning features of the Platform, including but not limited to MotorIQ (dynamic pricing), FleetCopilot (conversational AI operations assistant), Rari (voice agent), Vault (document intelligence), and Margin (financial intelligence).</li>
        <li><strong>"Drive Exotiq"</strong> means the renter-facing online travel agency marketplace operated by Exotiq at driveexotiq.com.</li>
        <li><strong>"Vehicle Partner"</strong> means a vehicle owner who consigns one or more vehicles to a Customer for rental operations managed through the Platform.</li>
        <li><strong>"Founding Member"</strong> means a Customer who subscribed to the Platform during the founding membership period and received lifetime locked pricing.</li>
        <li><strong>"Subscription Plan"</strong> means the specific tier (Starter, Professional, Business, or Enterprise) selected by the Customer, as described in Section 5.</li>
        <li><strong>"Third-Party Services"</strong> means services integrated with or accessed through the Platform that are provided by entities other than Exotiq, including but not limited to Stripe, ElevenLabs, Google (Gemini API), telematics providers, and insurance partners.</li>
      </ul>

      <h1>2. Platform Description and Scope</h1>

      <h2>2.1 Command Center Modules</h2>
      <p>The Platform provides the following modules, subject to your Subscription Plan:</p>

      <h3>Operations Modules</h3>
      <ul>
        <li><strong>Dashboard.</strong> Fleet status overview and key performance metrics.</li>
        <li><strong>Bookings.</strong> Reservation lifecycle management, calendar, payment processing, and guest CRM.</li>
        <li><strong>Fleet.</strong> Vehicle inventory management, status tracking, telematics integration, and maintenance scheduling.</li>
        <li><strong>Pulse.</strong> Operational health monitoring, utilization analytics, and performance tracking.</li>
        <li><strong>Margin.</strong> Financial intelligence including revenue dashboards, expense tracking, vehicle-level profitability, and partner revenue splits.</li>
      </ul>

      <h3>Intelligence Modules</h3>
      <ul>
        <li><strong>MotorIQ.</strong> AI-powered dynamic pricing engine with demand analysis, competitor monitoring, event-driven pricing adjustments, and revenue optimization recommendations.</li>
        <li><strong>FleetCopilot.</strong> AI conversational assistant for fleet operations, powered by the Rari voice agent, enabling natural language fleet management and multi-vehicle operations.</li>
        <li><strong>Vault.</strong> Compliance management, document storage, e-signature capture, expiration tracking, and regulatory deadline monitoring.</li>
      </ul>

      <h2>2.2 Drive Exotiq Marketplace</h2>
      <p>Subject to separate marketplace terms, Customers may list vehicles on the Drive Exotiq marketplace. The fee structure is as follows:</p>
      <ol>
        <li>10% renter-side fee, added to the booking total and visible to the renter;</li>
        <li>10% host-side fee, deducted from Customer gross revenue;</li>
        <li>20% total platform fee; and</li>
        <li>Direct bookings via Customer-specific referral links: 0% platform fee.</li>
      </ol>

      <h2>2.3 Module Availability</h2>
      <p>Not all modules are available on all Subscription Plans. Feature access is determined by your selected tier as described in Section 5. Exotiq reserves the right to modify, add, or retire modules with reasonable notice to affected Customers.</p>

      <h1>3. Account Registration and Security</h1>

      <h2>3.1 Account Requirements</h2>
      <p>To use the Platform, you must: (a) provide accurate, current, and complete registration information; (b) maintain the security of your account credentials; (c) promptly update your information if it changes; and (d) accept all risks of unauthorized access to your account resulting from your failure to comply with the foregoing.</p>

      <h2>3.2 Authorized Users</h2>
      <p>You are responsible for all activity occurring under your account, including activity by employees, contractors, Vehicle Partners, and any other individuals you authorize to access the Platform. You must ensure all authorized users comply with these Terms.</p>

      <h2>3.3 Account Security</h2>
      <p>You must immediately notify Exotiq at security@exotiq.ai if you become aware of any unauthorized access to or use of your account. Exotiq will not be liable for any loss arising from unauthorized use of your account where you have failed to maintain adequate security of your credentials.</p>

      <h1>4. Customer Data Ownership and Rights</h1>

      <h2>4.1 Ownership</h2>
      <p>You retain all rights, title, and interest in and to your Customer Data. Exotiq does not claim ownership of any Customer Data.</p>

      <h2>4.2 License Grant to Exotiq</h2>
      <p>You grant Exotiq a limited, non-exclusive, worldwide license to access, use, process, and display your Customer Data solely for the purposes of: (a) providing and improving the Platform; (b) generating AI-driven insights, pricing recommendations, and analytics for your account; and (c) providing technical support. This license terminates when your subscription ends, subject to Section 14.</p>

      <h2>4.3 Aggregated and Anonymized Data</h2>
      <p>Exotiq may create and use aggregated, anonymized, or de-identified data derived from Customer Data for product improvement, benchmarking, and market analysis. Such data will not identify you or any individual renter. This aggregated data may be retained and used after termination of your account.</p>

      <h2>4.4 Data Portability</h2>
      <p>Upon request, Exotiq will provide you with an export of your Customer Data in a standard machine-readable format (CSV or JSON) within thirty (30) business days. One data export per calendar year is included at no additional charge. Additional exports may be subject to a reasonable processing fee.</p>

      <h2>4.5 Renter Data</h2>
      <p>Renter information collected through the Platform (names, contact information, identification documents, rental history) is your Customer Data and is subject to your own privacy policy and applicable law. You are solely responsible for obtaining any required consents from renters for the collection, storage, and processing of their personal information through the Platform.</p>

      <h1>5. Subscription Plans and Pricing</h1>

      <h2>5.1 Tier Structure</h2>
      <p>The Platform is offered under the following Subscription Plans:</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Monthly Price</th>
              <th>Fleet Size</th>
              <th>Key Features</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Starter</td>
              <td>$29/vehicle/mo (min $79)</td>
              <td>1–10 vehicles</td>
              <td>7-day forecasting, basic AI, email support</td>
            </tr>
            <tr>
              <td>Professional</td>
              <td>$399/mo flat</td>
              <td>5–25 vehicles</td>
              <td>30-day forecasting, full AI, API, chat support</td>
            </tr>
            <tr>
              <td>Business</td>
              <td>$899/mo flat</td>
              <td>26–75 vehicles</td>
              <td>90-day forecasting, white-label, phone support</td>
            </tr>
            <tr>
              <td>Enterprise</td>
              <td>$1,799/mo flat</td>
              <td>76–150 vehicles</td>
              <td>365-day forecasting, custom AI, 24/7 support</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>5.2 Overage Pricing</h2>
      <p>If your active vehicle count exceeds the maximum permitted under your Subscription Plan, overage fees shall apply per additional vehicle as follows: Professional tier, $22 per vehicle; Business tier, $18 per vehicle; Enterprise tier, $15 per vehicle. Overage fees are billed monthly in arrears.</p>

      <h2>5.3 Annual Prepayment</h2>
      <p>Customers who prepay annually shall receive a discount equivalent to two (2) months of their Subscription Plan. Annual prepayments are non-refundable except as required by applicable law.</p>

      <h2>5.4 Founding Member Pricing</h2>
      <p>Customers who subscribed during the Founding Member enrollment period shall receive their subscription rate locked for the lifetime of their continuous subscription. Founding Member pricing is forfeited if the subscription lapses for more than thirty (30) consecutive days.</p>

      <h2>5.5 Price Changes</h2>
      <p>Exotiq may adjust pricing for non-Founding Member accounts upon sixty (60) days prior written notice. Price changes shall take effect at the commencement of the next billing cycle following expiration of the notice period. Founding Member pricing is exempt from price increases for the duration of continuous enrollment.</p>

      <h2>5.6 Taxes</h2>
      <p>All prices are exclusive of applicable taxes. You are responsible for all taxes, duties, and government assessments associated with your use of the Platform, excluding taxes based on Exotiq's net income.</p>

      <h1>6. Payment Terms</h1>

      <h2>6.1 Payment Processing</h2>
      <p>All payments are processed through Stripe, Inc. ("Stripe"). By subscribing to the Platform, you agree to be bound by Stripe's terms of service. Exotiq does not directly store credit card numbers or banking credentials.</p>

      <h2>6.2 Billing Cycle</h2>
      <p>Monthly subscriptions are billed on the anniversary of your subscription start date. Annual subscriptions are billed on the annual anniversary thereof. Overage fees are billed on the first business day of the following month.</p>

      <h2>6.3 Failed Payments</h2>
      <p>If a payment fails, Exotiq shall: (a) notify you via email; (b) attempt to process payment again after three (3) business days; and (c) attempt a final time after seven (7) business days. If all three attempts fail, your account may be suspended until payment is received. Customer Data will be retained for thirty (30) days following suspension, after which it may be permanently deleted.</p>

      <h2>6.4 Refunds</h2>
      <p>Monthly subscriptions: no refunds shall be issued for partial months. Annual subscriptions: pro-rated refunds are available within the first thirty (30) days following payment. After thirty (30) days, annual subscriptions are non-refundable. Drive Exotiq marketplace fees are non-refundable once a booking has been completed.</p>

      <h1>7. AI Services: Disclaimers and Limitations</h1>

      <h2>7.1 Advisory Nature of AI Recommendations</h2>
      <p>The AI Services, including but not limited to MotorIQ pricing recommendations, FleetCopilot operational suggestions, and Margin financial analytics, are decision-support tools. All AI-generated outputs, recommendations, forecasts, and analyses are advisory in nature and do not constitute guarantees of any specific outcome.</p>

      <h2>7.2 No Guarantee of Revenue Outcomes</h2>
      <p>While Exotiq's AI pricing engine has demonstrated revenue improvements in validation testing, these results are not guaranteed for any specific fleet, market, or time period. Actual results depend on factors including but not limited to market conditions, fleet composition, vehicle condition, operator responsiveness, local competition, and seasonal demand patterns. Past performance metrics referenced in marketing materials are illustrative, not predictive.</p>

      <h2>7.3 Human Oversight Requirement</h2>
      <p>You acknowledge and agree that: (a) AI-generated pricing recommendations should be reviewed before application; (b) you remain solely responsible for all pricing, operational, and business decisions made using or informed by AI outputs; (c) AI models may produce inaccurate, incomplete, or suboptimal recommendations; and (d) you will not rely exclusively on AI outputs without exercising independent business judgment.</p>

      <h2>7.4 AI Model Updates</h2>
      <p>Exotiq continuously improves its AI models. Model updates, retraining, or algorithm changes may result in different recommendations for identical inputs. Exotiq will use commercially reasonable efforts to maintain or improve recommendation quality but does not guarantee consistency between model versions.</p>

      <h2>7.5 Voice AI (Rari/FleetCopilot)</h2>
      <p>The Rari voice agent is powered by ElevenLabs. Voice interactions may be processed by ElevenLabs' infrastructure pursuant to their terms of service and privacy policy. Exotiq does not guarantee uninterrupted availability of voice features, which depend on third-party service uptime. Voice commands that result in pricing changes, booking modifications, or other operational actions are executed at your direction and sole responsibility.</p>

      <h2>7.6 Demand Forecasting</h2>
      <p>Demand forecasting features utilize the Google Gemini API for event data and trend analysis. Forecasts are probabilistic estimates and not certainties. Actual demand may differ materially from forecasted demand due to unpredictable market events, weather, regulatory changes, or other external factors beyond Exotiq's control.</p>

      <h1>8. Vault: Document and Compliance Terms</h1>

      <h2>8.1 No Legal Document Templates</h2>
      <p>Exotiq does not provide, draft, review, or warrant any rental agreement templates, liability waivers, or other legal documents. You are solely responsible for the content, accuracy, legal sufficiency, and enforceability of all documents stored in or processed through Vault. Exotiq strongly recommends that you consult qualified legal counsel for the preparation and review of rental agreements and compliance documentation.</p>

      <h2>8.2 E-Signature</h2>
      <p>Vault provides built-in canvas signature capture functionality. Documents signed through Vault receive a human-readable Exotiq Document Reference (format: EXQ-DOC-YYYY-NNNNN). While Exotiq designs its e-signature functionality to comply with the Electronic Signatures in Global and National Commerce Act (ESIGN Act) and the Uniform Electronic Transactions Act (UETA), Exotiq does not guarantee the legal enforceability of any electronically signed document in any jurisdiction. You are responsible for ensuring that electronic signatures meet the requirements applicable to your specific use case and jurisdiction.</p>

      <h2>8.3 Compliance Monitoring</h2>
      <p>Vault's compliance tracking features (insurance expiration alerts, registration monitoring, inspection scheduling) are provided as operational aids only. Exotiq does not guarantee the accuracy or completeness of compliance alerts and does not assume any responsibility for compliance failures. You remain solely responsible for meeting all applicable regulatory, licensing, insurance, and legal requirements for your fleet operations.</p>

      <h2>8.4 Document Storage</h2>
      <p>Documents uploaded to Vault are stored with encryption at rest. Exotiq maintains commercially reasonable security measures but does not guarantee that stored documents will be free from loss, corruption, or unauthorized access. You should maintain independent copies of all critical documents.</p>

      <h1>9. Margin: Financial Intelligence Terms</h1>

      <h2>9.1 Financial Data Sources</h2>
      <p>Margin derives financial data primarily from Stripe transaction records synchronized to the Exotiq database. Exotiq does not perform independent audits or verification of financial data. The accuracy of Margin's reports and analytics depends on the accuracy and completeness of underlying Stripe records and any manually entered data (including expenses, partner split configurations, and cash payment records).</p>

      <h2>9.2 Not Financial Advice</h2>
      <p>Margin's reports, dashboards, profitability analyses, and forecasts are informational tools only. They do not constitute financial, tax, investment, or accounting advice. You should consult qualified financial and tax professionals for all financial and tax-related decisions. Exotiq is not a registered financial advisor, accountant, or tax preparer.</p>

      <h2>9.3 Vehicle Partner Splits</h2>
      <p>If you configure vehicle partner revenue splits (whether percentage-based or flat-fee structures) within Margin, you are solely responsible for the accuracy of those configurations and for all payment obligations to your Vehicle Partners. Exotiq calculates and displays split amounts based on your configurations but does not execute, guarantee, or assume any liability for partner payouts.</p>

      <h1>10. Third-Party Services and Integrations</h1>

      <h2>10.1 Stripe Connect</h2>
      <p>Payment processing is provided by Stripe pursuant to Stripe's terms of service and privacy policy. You must maintain an active Stripe Connect account to process payments through the Platform. Exotiq is not responsible for Stripe's service availability, processing errors, held funds, or compliance requirements imposed by Stripe.</p>

      <h2>10.2 Telematics Providers</h2>
      <p>The Platform integrates with third-party telematics providers including Bouncie, Verizon Connect, and Zubie. Telematics data accuracy, availability, and latency are determined by your selected telematics provider. Exotiq does not guarantee the accuracy of GPS, diagnostic, or vehicle health data received from telematics systems.</p>

      <h2>10.3 AI Infrastructure Providers</h2>
      <p>The Platform utilizes services from ElevenLabs (voice AI), Google (Gemini API), OpenAI, and Anthropic (Claude) for various AI features. Your use of the Platform constitutes acknowledgment that certain data may be processed by these providers pursuant to their respective terms of service and privacy policies. Exotiq selects and configures these providers to align with its Privacy Policy but does not control their independent data practices.</p>

      <h2>10.4 Third-Party Service Failures</h2>
      <p>Exotiq shall not be liable for any Platform feature degradation, service interruption, or data processing failure caused by the unavailability, error, or policy change of any Third-Party Service. Exotiq will use commercially reasonable efforts to notify you of known third-party service disruptions that materially affect Platform functionality.</p>

      <h1>11. Intellectual Property</h1>

      <h2>11.1 Exotiq's Intellectual Property</h2>
      <p>The Platform, including its source code, algorithms, AI models, user interface, documentation, APIs, and brand elements (including the names Exotiq, MotorIQ, Pulse, Margin, FleetCopilot, Vault, Rari, Drive Exotiq, and Command Center), and all related intellectual property are and shall remain the exclusive property of Exotiq Inc. Your subscription grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Platform during the term of your subscription.</p>

      <h2>11.2 Restrictions</h2>
      <p>You shall not: (a) reverse engineer, decompile, or disassemble any part of the Platform; (b) copy, modify, or create derivative works based on the Platform; (c) sublicense, sell, resell, or distribute access to the Platform to any third party; (d) use the Platform to build a competitive product or service; (e) remove or alter any proprietary notices or markings; or (f) use automated tools to scrape, crawl, or extract data from the Platform except through approved API endpoints.</p>

      <h2>11.3 Feedback</h2>
      <p>If you provide feedback, feature requests, or suggestions regarding the Platform, you hereby grant Exotiq an irrevocable, perpetual, royalty-free, worldwide license to use, modify, and incorporate such feedback into the Platform without any obligation or compensation to you.</p>

      <h1>12. Warranties and Disclaimers</h1>

      <h2>12.1 Limited Warranty</h2>
      <p>Exotiq warrants that: (a) the Platform will perform materially in accordance with its published documentation during the term of your subscription; and (b) Exotiq will provide the Platform using commercially reasonable care and skill.</p>

      <h2>12.2 Disclaimer of Warranties</h2>
      <p className="uppercase font-semibold">
        EXCEPT AS EXPRESSLY SET FORTH IN SECTION 12.1, THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE." EXOTIQ HEREBY DISCLAIMS ALL OTHER WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. EXOTIQ DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE, OR THAT ALL DEFECTS WILL BE CORRECTED.
      </p>

      <h2>12.3 AI-Specific Disclaimers</h2>
      <p className="uppercase font-semibold">
        WITHOUT LIMITING THE GENERALITY OF SECTION 12.2, EXOTIQ SPECIFICALLY DISCLAIMS ANY WARRANTY REGARDING: (A) THE ACCURACY, COMPLETENESS, OR RELIABILITY OF AI-GENERATED PRICING RECOMMENDATIONS, DEMAND FORECASTS, OR FINANCIAL ANALYSES; (B) THE ACHIEVEMENT OF ANY SPECIFIC REVENUE, UTILIZATION, OR FINANCIAL OUTCOME; (C) THE CONTINUOUS AVAILABILITY OF VOICE AI FEATURES DEPENDENT ON THIRD-PARTY INFRASTRUCTURE; AND (D) THE LEGAL ENFORCEABILITY OF ELECTRONICALLY SIGNED DOCUMENTS IN ANY JURISDICTION.
      </p>

      <h1>13. Limitation of Liability</h1>

      <h2>13.1 Exclusion of Consequential Damages</h2>
      <p className="uppercase font-semibold">
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOST PROFITS, LOST REVENUE, LOST DATA, LOSS OF BUSINESS OPPORTUNITY, BUSINESS INTERRUPTION, OR COST OF PROCUREMENT OF SUBSTITUTE SERVICES, ARISING OUT OF OR RELATED TO THESE TERMS, REGARDLESS OF THE THEORY OF LIABILITY (WHETHER IN CONTRACT, TORT, STRICT LIABILITY, OR OTHERWISE) AND EVEN IF SUCH PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>

      <h2>13.2 Cap on Liability</h2>
      <p className="uppercase font-semibold">
        EXOTIQ'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS, WHETHER IN CONTRACT, TORT, OR OTHERWISE, SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES ACTUALLY PAID BY YOU TO EXOTIQ DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (B) ONE THOUSAND UNITED STATES DOLLARS ($1,000 USD).
      </p>

      <h2>13.3 Exceptions</h2>
      <p>The limitations set forth in Sections 13.1 and 13.2 shall not apply to: (a) your payment obligations under these Terms; (b) either party's indemnification obligations under Section 15; (c) either party's breach of confidentiality obligations under Section 16; or (d) liability that cannot be limited or excluded under applicable law.</p>

      <h2>13.4 Vehicle and Rental Liability</h2>
      <p>Exotiq is a software platform provider only. Exotiq has no ownership interest in, custody of, or physical control over any vehicles managed through the Platform. Exotiq shall not be liable for any property damage, personal injury, bodily harm, theft, accident, or any other loss or liability arising from the rental, operation, maintenance, or use of any vehicle, regardless of whether such rental was facilitated through the Platform or the Drive Exotiq marketplace.</p>

      <h1>14. Term, Termination, and Data Retention</h1>

      <h2>14.1 Term</h2>
      <p>These Terms become effective on the date you first access the Platform and shall continue in effect for the duration of your active subscription, unless earlier terminated in accordance with this Section 14.</p>

      <h2>14.2 Termination by Customer</h2>
      <p>You may cancel your subscription at any time through the Platform's account settings or by contacting Exotiq. Cancellation takes effect at the end of your current billing period. No refund shall be issued for any remaining portion of a prepaid billing period, except as provided in Section 6.4.</p>

      <h2>14.3 Termination by Exotiq</h2>
      <p>Exotiq may suspend or terminate your account if: (a) you materially breach these Terms or the Acceptable Use Policy; (b) your payment is delinquent for more than thirty (30) days; (c) you engage in activity that threatens the security, integrity, or performance of the Platform or its users; or (d) required by applicable law or regulation. Exotiq will provide reasonable prior notice before termination except where immediate action is necessary to prevent harm.</p>

      <h2>14.4 Data Retention After Termination</h2>
      <p>Following termination of your subscription: (a) your Customer Data will be available for export for thirty (30) days; (b) after such thirty (30) day period, Customer Data will be permanently deleted from active systems within sixty (60) additional days; (c) encrypted backup copies may persist for up to ninety (90) additional days before permanent deletion; and (d) aggregated, anonymized data derived from your Customer Data may be retained indefinitely.</p>

      <h2>14.5 Survival</h2>
      <p>The following Sections shall survive any termination or expiration of these Terms: 4 (Customer Data Ownership), 7 (AI Disclaimers), 11 (Intellectual Property), 12 (Warranties and Disclaimers), 13 (Limitation of Liability), 15 (Indemnification), 16 (Confidentiality), 17 (Governing Law), and 18 (Dispute Resolution).</p>

      <h1>15. Indemnification</h1>

      <h2>15.1 Customer Indemnification</h2>
      <p>You agree to indemnify, defend, and hold harmless Exotiq, its officers, directors, employees, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) your use of the Platform; (b) your breach of these Terms; (c) your violation of applicable law; (d) any rental transaction facilitated through the Platform; (e) the content, accuracy, or legal sufficiency of your rental agreements or other documents stored in Vault; (f) any claim by a renter, Vehicle Partner, or third party related to your fleet operations; or (g) your failure to comply with applicable regulations, licensing requirements, or insurance obligations.</p>

      <h2>15.2 Exotiq Indemnification</h2>
      <p>Exotiq shall indemnify and defend you against third-party claims alleging that the Platform, as provided by Exotiq and used in accordance with these Terms, infringes a valid United States patent, copyright, or trademark, provided that: (a) you promptly notify Exotiq of the claim in writing; (b) you grant Exotiq sole control of the defense and settlement of the claim; and (c) you provide reasonable cooperation at Exotiq's expense. This indemnity shall not apply to claims arising from: (i) your modifications to the Platform; (ii) use of the Platform in combination with products or services not provided by Exotiq; or (iii) your use of a version of the Platform other than the then-current version.</p>

      <h1>16. Confidentiality</h1>
      <p>Each party agrees to maintain the confidentiality of the other party's proprietary and confidential information disclosed in connection with these Terms, using at least the same degree of care used to protect its own confidential information of like kind (but in no event less than reasonable care). Confidential information shall not include information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was lawfully in the possession of the receiving party prior to disclosure; (c) is independently developed by the receiving party without reference to the disclosing party's confidential information; or (d) is rightfully obtained from a third party without restriction on disclosure.</p>

      <h1>17. Governing Law</h1>
      <p>These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without giving effect to any principles of conflicts of law. The United Nations Convention on Contracts for the International Sale of Goods shall not apply to these Terms.</p>

      <h1>18. Dispute Resolution</h1>

      <h2>18.1 Informal Resolution</h2>
      <p>Prior to initiating any formal dispute resolution proceeding, you agree to first contact Exotiq at legal@exotiq.ai and attempt in good faith to resolve the dispute informally for a period of at least thirty (30) days.</p>

      <h2>18.2 Binding Arbitration</h2>
      <p>Any dispute, claim, or controversy arising out of or relating to these Terms or the breach, termination, enforcement, interpretation, or validity thereof, that is not resolved pursuant to Section 18.1, shall be determined by binding arbitration administered by the American Arbitration Association ("AAA") in accordance with its Commercial Arbitration Rules then in effect. The arbitration shall be conducted in the State of Delaware by a single arbitrator selected in accordance with AAA rules. The arbitrator's decision shall be final and binding upon the parties, and judgment upon the award may be entered in any court of competent jurisdiction.</p>

      <h2>18.3 Class Action Waiver</h2>
      <p className="uppercase font-semibold">
        YOU AND EXOTIQ EACH AGREE THAT ANY PROCEEDINGS TO RESOLVE DISPUTES WILL BE CONDUCTED SOLELY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. NEITHER YOU NOR EXOTIQ SHALL BE ENTITLED TO JOIN OR CONSOLIDATE CLAIMS IN ARBITRATION OR TO INCLUDE CLASS-WIDE PROCEDURES IN ANY ARBITRATION.
      </p>

      <h2>18.4 Exceptions to Arbitration</h2>
      <p>Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to protect its intellectual property rights or confidential information, without the requirement of posting bond or proving actual damages, and without waiving its right to arbitration of the underlying dispute.</p>

      <h1>19. General Provisions</h1>

      <h2>19.1 Entire Agreement</h2>
      <p>These Terms, together with the Privacy Policy, Acceptable Use Policy, Data Processing Agreement, and any applicable Order Forms or Statements of Work, constitute the entire agreement between you and Exotiq with respect to the subject matter hereof and supersede all prior or contemporaneous agreements, representations, and understandings.</p>

      <h2>19.2 Severability</h2>
      <p>If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court or arbitrator of competent jurisdiction, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to render it valid and enforceable while preserving its original intent.</p>

      <h2>19.3 No Waiver</h2>
      <p>The failure of either party to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision. Any waiver of any provision shall be effective only if in writing and signed by the waiving party.</p>

      <h2>19.4 Assignment</h2>
      <p>You may not assign or transfer these Terms, or any rights or obligations hereunder, without Exotiq's prior written consent. Exotiq may freely assign these Terms in connection with a merger, acquisition, corporate reorganization, or sale of all or substantially all of its assets. Subject to the foregoing, these Terms shall be binding upon and inure to the benefit of the parties and their respective successors and permitted assigns.</p>

      <h2>19.5 Force Majeure</h2>
      <p>Neither party shall be liable for any delay or failure in performance resulting from causes beyond its reasonable control, including but not limited to acts of God, natural disasters, epidemics or pandemics, government orders or regulations, labor disputes, internet or telecommunications failures, cyberattacks, or failures of Third-Party Services. The affected party shall provide prompt notice and use commercially reasonable efforts to resume performance.</p>

      <h2>19.6 Notices</h2>
      <p>All notices required or permitted under these Terms must be in writing and shall be deemed given when: (a) delivered personally; (b) sent by confirmed email; or (c) sent by nationally recognized overnight courier. Notices to Exotiq shall be sent to legal@exotiq.ai. Notices to Customer shall be sent to the email address associated with the Customer's account.</p>

      <h2>19.7 Independent Contractors</h2>
      <p>The relationship of the parties is that of independent contractors. Nothing in these Terms shall be construed to create a partnership, joint venture, employment, franchise, or agency relationship between the parties.</p>

      <h2>19.8 Amendments</h2>
      <p>Exotiq may amend these Terms by posting revised Terms on the Platform and providing not less than thirty (30) days prior notice via email to the address associated with your account. Your continued use of the Platform following the effective date of any amendment shall constitute acceptance of the amended Terms. Material changes to the arbitration provisions or limitations of liability shall require your affirmative written consent.</p>

      <p className="mt-8 text-sm">
        For questions regarding these Terms, contact: <a href="mailto:legal@exotiq.ai">legal@exotiq.ai</a>
      </p>
      <p className="text-sm">Exotiq Inc., a Delaware C-Corporation</p>
    </LegalPageLayout>
  );
};

export default Terms;
