// Canonical sub-processor registry. Mirrored into the public.sub_processors
// table via the seed migration so the DPA page and Settings → Legal can
// surface it without re-papering when we add or remove a provider.
//
// IMPORTANT: keep this list in sync with `supabase/migrations/*_seed_compliance_reference_data.sql`.

export interface SubProcessor {
  name: string;
  purpose: string;
  region: string; // human label, e.g. "United States", "Global (multi-region)"
  transferMechanism: string; // SCCs / DPF / N/A
  dpaUrl?: string;
  privacyPolicyUrl?: string;
  status: "active" | "pending" | "retired";
  notes?: string;
}

export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Lovable Cloud (managed Supabase)",
    purpose: "Primary application database, authentication, storage, and edge function runtime.",
    region: "United States",
    transferMechanism: "SCCs (2021/914) Module 2",
    dpaUrl: "https://lovable.dev/legal/dpa",
    privacyPolicyUrl: "https://lovable.dev/privacy",
    status: "active",
  },
  {
    name: "Stripe, Inc.",
    purpose: "Payment processing, Connect onboarding, identity verification tokens.",
    region: "United States / Ireland",
    transferMechanism: "SCCs + DPF certified",
    dpaUrl: "https://stripe.com/legal/dpa",
    privacyPolicyUrl: "https://stripe.com/privacy",
    status: "active",
  },
  {
    name: "Google (Gemini / Vision via Lovable AI Gateway)",
    purpose: "AI features: vehicle metadata extraction, photo vision, pricing/demand insights.",
    region: "United States / Global",
    transferMechanism: "SCCs + DPF certified",
    dpaUrl: "https://cloud.google.com/terms/data-processing-addendum",
    privacyPolicyUrl: "https://policies.google.com/privacy",
    status: "active",
  },
  {
    name: "OpenAI, L.L.C.",
    purpose: "Rari conversational AI features.",
    region: "United States",
    transferMechanism: "SCCs",
    dpaUrl: "https://openai.com/policies/data-processing-addendum",
    privacyPolicyUrl: "https://openai.com/policies/privacy-policy",
    status: "active",
  },
  {
    name: "Anthropic, PBC",
    purpose: "Rari conversational AI features (Claude models).",
    region: "United States",
    transferMechanism: "SCCs",
    dpaUrl: "https://www.anthropic.com/legal/dpa",
    privacyPolicyUrl: "https://www.anthropic.com/legal/privacy",
    status: "active",
  },
  {
    name: "ElevenLabs, Inc.",
    purpose: "Rari voice agent text-to-speech.",
    region: "United States",
    transferMechanism: "SCCs",
    dpaUrl: "https://elevenlabs.io/dpa",
    privacyPolicyUrl: "https://elevenlabs.io/privacy",
    status: "active",
  },
  {
    name: "Google Calendar API",
    purpose: "Optional one-way push of booking events to operator-owned Google Calendars.",
    region: "United States / Global",
    transferMechanism: "SCCs + DPF certified",
    dpaUrl: "https://cloud.google.com/terms/data-processing-addendum",
    privacyPolicyUrl: "https://policies.google.com/privacy",
    status: "active",
  },
  {
    name: "MotorIQ",
    purpose: "External rental marketplace distribution and price syncing.",
    region: "United States",
    transferMechanism: "SCCs (under negotiation)",
    status: "active",
  },
];
