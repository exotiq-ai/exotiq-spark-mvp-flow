// App Configuration
export const APP_CONFIG = {
  name: 'ExotIQ.ai',
  description: 'AI-Powered Fleet Management Platform',
  version: '1.0.0',
  author: 'ExotIQ.ai Team',
  supportEmail: 'support@exotiq.ai',
  websiteUrl: 'https://exotiq.ai',
  contactUrl: 'https://exotiq.ai/contact',
} as const;

// API Configuration
export const API_CONFIG = {
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api.exotiq.ai'
    : 'http://localhost:3001',
  timeout: 30000,
  retryAttempts: 3,
} as const;

// UI Constants
export const UI_CONFIG = {
  animations: {
    fast: 150,
    medium: 300,
    slow: 500,
  },
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },
  maxWidths: {
    content: '1400px',
    form: '500px',
    modal: '600px',
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  theme: 'exotiq-theme',
  userPreferences: 'exotiq-user-preferences',
  dashboardLayout: 'exotiq-dashboard-layout',
  recentSearches: 'exotiq-recent-searches',
  onboardingCompleted: 'exotiq-onboarding-completed',
} as const;

// Module Configuration
export const MODULES = {
  motoriq: {
    id: 'motoriq',
    name: 'MotorIQ',
    description: 'Fleet Profitability Engine',
    features: ['Revenue Optimization', 'Predictive Analytics', 'Market Intelligence'],
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse',
    description: 'Live Fleet Analytics',
    features: ['Real-time Monitoring', 'Performance Metrics', 'Alert System'],
  },
  book: {
    id: 'book',
    name: 'Book',
    description: 'Direct Booking Tools',
    features: ['Online Reservations', 'Calendar Management', 'Customer Portal'],
  },
  vault: {
    id: 'vault',
    name: 'Vault',
    description: 'Compliance Hub',
    features: ['Document Management', 'Compliance Tracking', 'Audit Trails'],
  },
  core: {
    id: 'core',
    name: 'Core',
    description: 'Admin Control Center',
    features: ['User Management', 'System Settings', 'Data Analytics'],
  },
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  enableAdvancedAnalytics: true,
  enableAIRecommendations: true,
  enableMobileApp: false,
  enableBetaFeatures: process.env.NODE_ENV === 'development',
  enableTelemetry: process.env.NODE_ENV === 'production',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  general: 'An unexpected error occurred. Please try again.',
  network: 'Network error. Please check your connection and try again.',
  unauthorized: 'You are not authorized to perform this action.',
  notFound: 'The requested resource was not found.',
  validation: 'Please check your input and try again.',
  server: 'Server error. Please try again later.',
} as const;