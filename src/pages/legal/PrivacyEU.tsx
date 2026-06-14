// EU/UK Privacy Notice — counsel-drafted source (June 2026) narrowed
// against actual data collection. Drivers-license language removed
// because featureFlags.driversLicenseNumberField is off and identity
// verification routes through Stripe Identity (token + status only).

import { useEffect, useState } from "react";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { supabase } from "@/integrations/supabase/client";

interface Rep {
  name?: string | null;
  address?: string | null;
  email?: string | null;
}

const PrivacyEU = () => {
  const [eu, setEu] = useState<Rep>({});
  const [uk, setUk] = useState<Rep>({});

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: tm } = await (supabase.from("team_members") as any)
        .select("team_id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!tm?.team_id) return;
      const { data: team } = await (supabase.from("teams") as any)
        .select(
          "eu_representative_name, eu_representative_address, eu_representative_email, uk_representative_name, uk_representative_address, uk_representative_email"
        )
        .eq("id", tm.team_id)
        .maybeSingle();
      if (!team) return;
      setEu({
        name: team.eu_representative_name,
        address: team.eu_representative_address,
        email: team.eu_representative_email,
      });
      setUk({
        name: team.uk_representative_name,
        address: team.uk_representative_address,
        email: team.uk_representative_email,
      });
    })();
  }, []);

  return (
    <LegalPageLayout
      title="Privacy Notice (EU/UK)"
      subtitle="For data subjects in the European Economic Area and the United Kingdom"
      effectiveDate="June 14, 2026"
      lastUpdated="June 14, 2026"
    >
      <p>
        This notice explains how Exotiq Inc. ("Exotiq", "we") processes
        personal data of individuals located in the European Economic Area
        (EEA) and the United Kingdom (UK). It supplements our global Privacy
        Policy and prevails over it for data subjects in those regions.
      </p>

      <h2>1. Controller and representatives</h2>
      <p>
        Exotiq is the controller for personal data we process about operator
        accounts, and a processor on behalf of operators for the personal data
        of their end-renters.
      </p>
      <p>
        <strong>EU representative (GDPR Art. 27):</strong>{" "}
        {eu.name ? (
          <>
            {eu.name}
            {eu.address ? `, ${eu.address}` : ""}
            {eu.email ? ` — ${eu.email}` : ""}.
          </>
        ) : (
          <em>To be appointed by the operator before serving EU data subjects.</em>
        )}
      </p>
      <p>
        <strong>UK representative (UK GDPR Art. 27):</strong>{" "}
        {uk.name ? (
          <>
            {uk.name}
            {uk.address ? `, ${uk.address}` : ""}
            {uk.email ? ` — ${uk.email}` : ""}.
          </>
        ) : (
          <em>To be appointed by the operator before serving UK data subjects.</em>
        )}
      </p>

      <h2>2. Categories of personal data we process</h2>
      <p>
        Depending on how you interact with the Services, we may process:
        identity and contact details; account credentials; booking and rental
        records; payment-related records (processed by Stripe; we receive
        tokens and status, not card numbers); voice recordings and conversation
        logs from the Rari assistant; documents and electronic signatures
        stored in encrypted cloud storage; telematics-derived data when an
        operator integrates a telematics provider; and technical data such as
        IP address, device, and usage information. Identity verification for
        renters is performed by Stripe Identity; we receive a verification
        status and expiry, not the underlying identification document.
      </p>

      <h2>3. Purposes and lawful bases</h2>
      <ul>
        <li>
          <strong>Provide the Services</strong> — performance of contract
          (Art. 6(1)(b)).
        </li>
        <li>
          <strong>Fraud prevention, account security, audit logging</strong>{" "}
          — legitimate interests (Art. 6(1)(f)).
        </li>
        <li>
          <strong>Compliance with tax, AML and other legal obligations</strong>{" "}
          — legal obligation (Art. 6(1)(c)).
        </li>
        <li>
          <strong>Marketing communications</strong> — consent (Art. 6(1)(a));
          withdrawable any time.
        </li>
      </ul>

      <h2>4. International transfers</h2>
      <p>
        Personal data may be transferred to the United States and other
        countries where our sub-processors operate. Transfers rely on the EU
        Standard Contractual Clauses (and the UK International Data Transfer
        Addendum where applicable), supplemented by the safeguards described
        in our{" "}
        <a href="/transfer-addendum">International Data Transfer Addendum</a>.
        AI provider calls operate under a separate data-minimization layer
        that redacts personal data before transfer.
      </p>

      <h2>5. Retention</h2>
      <p>
        Retention periods are defined per data category in our Records of
        Processing and enforced by an automated sweep. Financial and tax
        records are retained for the minimum statutory period (typically 7 to
        10 years depending on jurisdiction); operational booking records for
        24 months after the last interaction; voice recordings and AI
        transcripts for 90 days unless attached to an active dispute.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Under the GDPR and UK GDPR you have the right of access, rectification,
        erasure, restriction, portability, and objection, and the right to
        lodge a complaint with your local supervisory authority. To exercise
        any of these rights, contact your operator account directly or
        privacy@exotiq.ai. We respond within one month.
      </p>

      <h2>7. Sub-processors</h2>
      <p>
        A current list of sub-processors is published in the operator
        dashboard and mirrored in the Data Processing Agreement. Operators
        receive at least 30 days notice before a new sub-processor begins
        processing.
      </p>

      <h2>8. Automated decision-making</h2>
      <p>
        We do not make decisions with legal or similarly significant effects
        about renters solely on the basis of automated processing. AI-assisted
        outputs (pricing suggestions, demand forecasts, copilot responses) are
        advisory and reviewed by a human operator before action.
      </p>

      <h2>9. Contact</h2>
      <p>
        privacy@exotiq.ai. For EU subjects: contact our EU representative
        above. For UK subjects: contact our UK representative above.
      </p>
    </LegalPageLayout>
  );
};

export default PrivacyEU;
