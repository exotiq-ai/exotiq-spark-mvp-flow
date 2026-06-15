// Feature Flags for Incomplete/Beta Features
// Set to false to hide features that are not ready for production
//
// ─────────────────────────────────────────────────────────────────────────────
// DPA §3.8 COMPLIANCE GATES (do NOT flip to true on the Lovable path)
// Our signed Lovable DPA §3.8 prohibits routing government identifiers,
// financial account numbers, and biometric data through Lovable Cloud and
// the AI Gateway. The flags below gate any UI/flow that would persist or
// transmit such categories via Lovable-managed infrastructure.
//
// Re-enable ONLY after one of:
//   (a) migration off Lovable to direct infrastructure, OR
//   (b) wiring through a confirmed non-Lovable provider:
//       - ID verification → Stripe Identity or Persona (store token + status
//         + expiry only; never the raw DL number or image)
//       - Receipt/invoice OCR → direct Google Document AI / Vision, bypassing
//         the Lovable AI Gateway
// See /legal/ DPA correspondence and HONEST_STATUS.md for context.
// ─────────────────────────────────────────────────────────────────────────────


export const featureFlags = {
  // Rari AI Features
  exportTranscript: true, // Enabled - implementing export functionality
  conversationHistory: true, // Enabled - history component ready
  
  // Dashboard Features  
  bulkActions: false,
  savedViews: false,
  advancedFilters: false,
  customReports: false,
  
  // Settings Features
  slackIntegration: false,
  webhookNotifications: false,
  
  // Booking Features
  recurringBookings: false,
  customPricing: false,
  
  // Fleet Features
  maintenanceTracking: true, // Ready
  documentManagement: true, // Ready
  complianceChecks: true, // Ready
  
  // Photo Hub v2 — Storage Optimization
  filenameAutoMatch: true, // Deterministic filename-to-vehicle scorer
  uploadPresets: true, // Context-aware compression presets
  thumbnailGeneration: true, // Client-side thumbnail generation
  concurrentUploads: true, // Parallel upload processing pool
  
  // Fleet Inventory Management
  vehicleEditDialog: true, // Edit vehicle details dialog
  vehicleChangeLog: true, // Audit trail for vehicle changes
  deleteUndoToast: true, // Undo toast pattern for vehicle deletion
  
  // Telematics
  telematicsIntegration: false, // Telematics tab — not yet implemented
  
  // Margin Module (Phase 1)
  margin: true, // Per-vehicle P&L, expenses, partner payouts — visible to Manager+

  // DPA §3.8 — prohibited data categories (keep OFF on Lovable path)
  idVerification: false, // Driver's license image upload / OCR
  receiptScanning: false, // Receipt/invoice OCR via AI Gateway → Gemini
  driversLicenseNumberField: false, // Typed government identifier input

  // International compliance (Phase 1 EU/UK)
  // Ships dark; flip to true only after attorney-reviewed GDPR/UK
  // privacy notice, DPA SCC annexes, IDTA, TIA, and DPIA are published.
  complianceEuUk: false,

  // Tenant-facing e-signature (Phase 1)
  // Exotiq super admins can send PDFs to a tenant for in-app signing.
  // Super-admin surface is always available for internal testing; the
  // tenant-facing banner / Vault section is gated by this flag.
  tenantEsignature: true,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: FeatureFlag): boolean => {
  return featureFlags[feature];
};

// Helper to conditionally render based on feature flag
export const withFeatureFlag = <T>(feature: FeatureFlag, component: T): T | null => {
  return isFeatureEnabled(feature) ? component : null;
};
