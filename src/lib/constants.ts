// App Configuration
export const APP_CONFIG = {
  name: 'Exotiq.ai',
  description: 'AI-Powered Fleet Management Platform',
  version: '1.0.0',
  author: 'Exotiq.ai Team',
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
    subtitle: 'Pricing Optimization',
    fullName: 'MotorIQ - Pricing Optimization',
    description: 'AI-powered dynamic pricing helps you maximize revenue. Get instant recommendations based on demand, seasonality, and market trends.',
    features: ['Revenue Optimization', 'Predictive Analytics', 'Market Intelligence', 'Dynamic Pricing'],
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse',
    subtitle: 'Real-time Analytics',
    fullName: 'Pulse - Real-time Analytics',
    description: 'Monitor your fleet performance with live analytics. Track revenue, utilization, and key metrics in real-time.',
    features: ['Real-time Monitoring', 'Performance Metrics', 'Alert System', 'Live Dashboard'],
  },
  book: {
    id: 'book',
    name: 'Book',
    subtitle: 'Reservations & Calendar',
    fullName: 'Book - Reservations & Calendar',
    description: 'Manage all your bookings in one place. View your calendar, handle reservations, and track upcoming pickups.',
    features: ['Online Reservations', 'Calendar Management', 'Customer Portal', 'Booking Tracking'],
  },
  vault: {
    id: 'vault',
    name: 'Vault',
    subtitle: 'Compliance Hub',
    fullName: 'Vault - Compliance Hub',
    description: 'Stay compliant with document management, insurance tracking, and automated reminders for renewals.',
    features: ['Document Management', 'Compliance Tracking', 'Audit Trails', 'Auto Reminders'],
  },
  core: {
    id: 'core',
    name: 'Core',
    subtitle: 'FleetCopilot™ Admin',
    fullName: 'Core - FleetCopilot™ Admin',
    description: 'Your fleet management command center. Handle operations, manage users, and access powerful admin tools.',
    features: ['User Management', 'System Settings', 'Data Analytics', 'Admin Tools'],
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