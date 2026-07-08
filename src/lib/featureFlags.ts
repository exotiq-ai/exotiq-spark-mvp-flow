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
  dailyBrief: true, // Command Center — Daily Brief hero card (shipped globally; use `?ff=dailyBrief:off` to disable per-browser)
  
  
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

  // Multi-currency & VAT (Phase 1)
  // Master kill-switch for non-USD tenants. Default ON. If a regression hits
  // US tenants, flip OFF — every code path falls back to USD/`Tax`/0% and
  // existing behaviour is preserved.
  multiCurrencyEnabled: true,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/**
 * Per-account flag override.
 *
 * Resolution order (highest priority first):
 *   1. URL query param `?ff=<flag>` or `?ff=<flag>:off`
 *      (also sets a persistent localStorage override, so you only paste once).
 *   2. localStorage `ff_<flag>` === '1' | '0'.
 *   3. Static default from `featureFlags` above.
 *
 * This lets the owner flip a feature on for just their browser without a deploy,
 * keeping the global default off until verified.
 */
const readQueryOverrides = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.getAll('ff');
    if (raw.length === 0) return;
    raw.forEach((entry) => {
      const [name, state] = entry.split(':');
      if (!name) return;
      const key = `ff_${name}`;
      window.localStorage.setItem(key, state === 'off' ? '0' : '1');
    });
  } catch {
    /* ignore */
  }
};
readQueryOverrides();

export const isFeatureEnabled = (feature: FeatureFlag): boolean => {
  if (typeof window !== 'undefined') {
    try {
      const override = window.localStorage.getItem(`ff_${feature}`);
      if (override === '1') return true;
      if (override === '0') return false;
    } catch {
      /* ignore */
    }
  }
  return featureFlags[feature];
};

// Helper to conditionally render based on feature flag
export const withFeatureFlag = <T>(feature: FeatureFlag, component: T): T | null => {
  return isFeatureEnabled(feature) ? component : null;
};
