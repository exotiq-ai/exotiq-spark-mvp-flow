// Feature Flags for Incomplete/Beta Features
// Set to false to hide features that are not ready for production

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
