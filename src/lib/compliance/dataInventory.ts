// Code-side manifest of every personal-data field Exotiq processes.
// Mirrored into public.data_processing_inventory via the seed migration.
//
// "lawfulBasis" values (GDPR Art. 6):
//   - contract        — necessary to perform the rental contract
//   - legal_obligation — required by law (insurance, tax, fraud, AML)
//   - legitimate_interest — operator's operations (fraud prevention, analytics)
//   - consent         — explicit opt-in (marketing, SMS, AI training, etc.)
//
// "neverTransfer" = MUST NOT leave Lovable Cloud to any sub-processor
// (used by src/lib/ai/transferGuard.ts to drop fields before AI calls).
//
// IMPORTANT: keep in sync with the seed migration.

export type LawfulBasis =
  | "contract"
  | "legal_obligation"
  | "legitimate_interest"
  | "consent";

export interface DataInventoryEntry {
  entity: string;
  field: string;
  category: string;
  description: string;
  lawfulBasis: LawfulBasis;
  retentionDays?: number;
  subProcessorNames: string[];
  regionPartitionable?: boolean;
  neverTransfer?: boolean;
  notes?: string;
}

export const DATA_INVENTORY: DataInventoryEntry[] = [
  // -------------------------------------------------------------- profiles
  {
    entity: "profiles",
    field: "full_name",
    category: "identity",
    description: "Operator user's full name.",
    lawfulBasis: "contract",
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },
  {
    entity: "profiles",
    field: "email",
    category: "contact",
    description: "Operator user's email address.",
    lawfulBasis: "contract",
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },
  {
    entity: "profiles",
    field: "phone",
    category: "contact",
    description: "Operator user's phone number.",
    lawfulBasis: "contract",
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },

  // ------------------------------------------------------------- customers
  {
    entity: "customers",
    field: "full_name",
    category: "identity",
    description: "Renter full name.",
    lawfulBasis: "contract",
    retentionDays: 2555, // 7 years post-last-booking (insurance/tax floor)
    subProcessorNames: ["Lovable Cloud (managed Supabase)", "Stripe, Inc."],
  },
  {
    entity: "customers",
    field: "email",
    category: "contact",
    description: "Renter email address.",
    lawfulBasis: "contract",
    retentionDays: 2555,
    subProcessorNames: ["Lovable Cloud (managed Supabase)", "Stripe, Inc."],
  },
  {
    entity: "customers",
    field: "phone",
    category: "contact",
    description: "Renter phone number (used for SMS opt-in if consented).",
    lawfulBasis: "contract",
    retentionDays: 2555,
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },
  {
    entity: "customers",
    field: "date_of_birth",
    category: "identity_sensitive",
    description: "Renter date of birth (insurance/age verification).",
    lawfulBasis: "legal_obligation",
    retentionDays: 2555,
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
    neverTransfer: true,
  },
  {
    entity: "customers",
    field: "address",
    category: "contact",
    description: "Renter postal address.",
    lawfulBasis: "contract",
    retentionDays: 2555,
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },
  {
    entity: "customers",
    field: "drivers_license_number",
    category: "government_identifier",
    description:
      "Driver's license number — currently disabled on the Lovable path (DPA §3.8). When re-enabled it MUST flow through Stripe Identity / Persona only.",
    lawfulBasis: "legal_obligation",
    retentionDays: 2555,
    subProcessorNames: [],
    neverTransfer: true,
    notes: "Gated by featureFlags.driversLicenseNumberField.",
  },

  // -------------------------------------------------------------- bookings
  {
    entity: "bookings",
    field: "pickup_location",
    category: "operational",
    description: "Pickup location and timing.",
    lawfulBasis: "contract",
    retentionDays: 2555,
    subProcessorNames: ["Lovable Cloud (managed Supabase)", "Google Calendar API"],
  },
  {
    entity: "bookings",
    field: "renter_notes",
    category: "operational",
    description: "Free-text notes attached to a booking.",
    lawfulBasis: "contract",
    retentionDays: 2555,
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },

  // -------------------------------------------------------------- payments
  {
    entity: "payments",
    field: "stripe_charge_id",
    category: "financial",
    description: "Stripe charge token (no raw PAN ever stored).",
    lawfulBasis: "contract",
    retentionDays: 3650, // tax/AML floor: 10 years in some jurisdictions
    subProcessorNames: ["Lovable Cloud (managed Supabase)", "Stripe, Inc."],
  },
  {
    entity: "payments",
    field: "last4",
    category: "financial",
    description: "Last four digits of payment instrument.",
    lawfulBasis: "contract",
    retentionDays: 3650,
    subProcessorNames: ["Lovable Cloud (managed Supabase)", "Stripe, Inc."],
  },

  // ----------------------------------------------- messages / communications
  {
    entity: "messages",
    field: "body",
    category: "communications",
    description: "In-app message content between operator and renter.",
    lawfulBasis: "contract",
    retentionDays: 1095, // 3 years
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },
  {
    entity: "team_messages",
    field: "body",
    category: "communications",
    description: "Internal team chat content.",
    lawfulBasis: "legitimate_interest",
    retentionDays: 1095,
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },

  // ----------------------------------------------- documents / inspections
  {
    entity: "documents",
    field: "file_url",
    category: "operational",
    description:
      "Operator-uploaded vehicle/registration/insurance documents (never raw driver IDs).",
    lawfulBasis: "legal_obligation",
    retentionDays: 2555,
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },
  {
    entity: "inspection_photos",
    field: "url",
    category: "operational",
    description: "Vehicle inspection photographs.",
    lawfulBasis: "contract",
    retentionDays: 730, // 2 years; metadata retained longer in vehicle_inspections
    subProcessorNames: [
      "Lovable Cloud (managed Supabase)",
      "Google (Gemini / Vision via Lovable AI Gateway)",
    ],
  },

  // ----------------------------------------------- AI / Rari
  {
    entity: "rari_messages",
    field: "content",
    category: "ai_conversation",
    description: "Rari conversation transcripts.",
    lawfulBasis: "consent",
    retentionDays: 395, // 13 months
    subProcessorNames: [
      "Lovable Cloud (managed Supabase)",
      "OpenAI, L.L.C.",
      "Anthropic, PBC",
      "Google (Gemini / Vision via Lovable AI Gateway)",
      "ElevenLabs, Inc.",
    ],
  },

  // ---------------------------------------------------- terms acceptances
  {
    entity: "terms_acceptances",
    field: "ip_address",
    category: "audit",
    description: "IP address captured at consent (ESIGN/UETA evidence).",
    lawfulBasis: "legal_obligation",
    retentionDays: 3650,
    subProcessorNames: ["Lovable Cloud (managed Supabase)"],
  },
];

export function inventoryByEntity(entity: string): DataInventoryEntry[] {
  return DATA_INVENTORY.filter((d) => d.entity === entity);
}

export function neverTransferFields(entity: string): Set<string> {
  return new Set(
    DATA_INVENTORY.filter((d) => d.entity === entity && d.neverTransfer).map(
      (d) => d.field
    )
  );
}
