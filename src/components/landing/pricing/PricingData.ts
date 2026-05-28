// Stripe Price IDs — 2026 Pricing Restructure (LIVE)
// Per-vehicle pricing. 14-day free trial, no credit card required.
export const STRIPE_PRICES = {
  pro: {
    monthly: 'price_1Tbv4IHO7nC3pJiPH4EbyVlL', // $39/vehicle/month
    annual:  'price_1Tbv4JHO7nC3pJiPqaBeoyAX', // $390/vehicle/year (2 months free)
    productId: 'prod_Ub7IM2Skj93HFS',
  },
  business: {
    monthly: 'price_1Tbv4KHO7nC3pJiPC5emMKgJ', // $29/vehicle/month
    annual:  'price_1Tbv4LHO7nC3pJiParUQCB7y', // $290/vehicle/year (2 months free)
    productId: 'prod_Ub7IlYXU1diSY8',
  },
} as const;

export interface PricingTier {
  id: 'pro' | 'business' | 'enterprise';
  name: string;
  // Pro/Business: per-vehicle/month. Enterprise: 0 (custom quote).
  price: number;
  priceType: 'per-vehicle' | 'custom';
  perVehicleRate?: number;     // per-vehicle monthly rate
  perVehicleAnnualRate?: number; // per-vehicle annual rate (10x monthly)
  minVehicles: number;
  maxVehicles: number;
  vehicleRange: string;
  popular: boolean;
  features: string[];
  aiForecasting: string;
  apiAccess: boolean;
  locations: string;
  supportSLA: string;
  valueProposition: string;
  isCustom?: boolean;
  // Legacy fields kept for backward compatibility — no longer used.
  minPrice?: number;
  overageRate?: number;
}

export const pricingTiers: PricingTier[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: 39,
    priceType: 'per-vehicle',
    perVehicleRate: 39,
    perVehicleAnnualRate: 390,
    minVehicles: 1,
    maxVehicles: 15,
    vehicleRange: '1–15 vehicles',
    popular: true,
    features: [
      'All features included',
      'MotorIQ AI pricing engine',
      'Unlimited bookings & customers',
      'Document vault with auto-alerts',
      'Email & chat support',
    ],
    aiForecasting: '30-day',
    apiAccess: true,
    locations: 'Up to 2 locations',
    supportSLA: 'Email + chat (24hr)',
    valueProposition: 'Best for boutique and growing fleets',
  },
  {
    id: 'business',
    name: 'Business',
    price: 29,
    priceType: 'per-vehicle',
    perVehicleRate: 29,
    perVehicleAnnualRate: 290,
    minVehicles: 16,
    maxVehicles: 50,
    vehicleRange: '16–50 vehicles',
    popular: false,
    features: [
      'Everything in Pro',
      'Priority support (4hr)',
      'Up to 5 locations',
      'White-label marketplace',
      'White-glove onboarding',
    ],
    aiForecasting: '90-day',
    apiAccess: true,
    locations: 'Up to 5 locations',
    supportSLA: 'Priority (4hr)',
    valueProposition: 'Volume pricing for established operations',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    priceType: 'custom',
    minVehicles: 51,
    maxVehicles: 9999,
    vehicleRange: '51+ vehicles',
    popular: false,
    isCustom: true,
    features: [
      'Everything in Business',
      'Custom AI model training',
      'Dedicated API & integrations',
      'Dedicated customer success manager',
      'Custom SLA & security review',
    ],
    aiForecasting: '365-day',
    apiAccess: true,
    locations: 'Unlimited',
    supportSLA: 'Dedicated CSM',
    valueProposition: 'For high-volume and multi-region operators',
  },
];

// Tier picker for fleet-size auto-selection
export const pickTierForFleetSize = (fleetSize: number): PricingTier => {
  if (fleetSize <= 15) return pricingTiers[0];
  if (fleetSize <= 50) return pricingTiers[1];
  return pricingTiers[2];
};

export const faqItems = [
  {
    question: 'How does the free trial work?',
    answer: 'Every account starts with a 14-day free trial — no credit card required. After 14 days, your account becomes read-only until you subscribe. Existing data is never deleted.',
  },
  {
    question: 'How is pricing calculated?',
    answer: 'Pro is $39/vehicle/month for fleets of 1–15. Business is $29/vehicle/month for fleets of 16–50. Both annual plans give you 2 months free. Enterprise (51+ vehicles) is custom-priced — book a call.',
  },
  {
    question: 'What happens if my fleet grows past my plan?',
    answer: 'You can resize your subscription anytime — billing adjusts automatically with prorated charges. Crossing into the next tier (e.g. from 15 → 16 vehicles) switches you to Business pricing.',
  },
  {
    question: 'Can I switch plans later?',
    answer: 'Yes. Upgrade, downgrade, or change billing frequency anytime from Settings → Billing. Changes are prorated.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'All major credit cards (Visa, Mastercard, Amex, Discover) and ACH for annual plans. Enterprise customers can pay via invoice with NET-30 terms.',
  },
  {
    question: 'Is there a setup fee?',
    answer: 'No setup fees. Onboarding, data migration, and training are included on every plan.',
  },
  {
    question: 'What if I need custom integrations?',
    answer: 'Business and Enterprise include API access. Enterprise also includes custom integration engineering — contact sales to scope.',
  },
];

export const coreFeatures = [
  { title: 'Core Fleet Dashboard',     description: 'Real-time fleet overview with vehicle status, availability, and key metrics at a glance' },
  { title: 'Pulse Analytics',          description: 'Revenue tracking, utilization reports, and performance insights across your entire fleet' },
  { title: 'Book Calendar',            description: 'Drag-and-drop booking management with conflict detection and customer notifications' },
  { title: 'Vault Document Management', description: 'Secure storage for insurance, registration, and maintenance documents with expiry alerts' },
  { title: 'Customer CRM',             description: 'Complete customer profiles with booking history, preferences, and communication logs' },
  { title: 'MotorIQ AI Engine',        description: 'AI-powered pricing recommendations that optimize your rates based on demand and competition' },
];

// ROI Calculator defaults — exotic rental industry benchmarks
export const roiDefaults = {
  avgDailyRate: 1500,
  avgUtilization: 52,
  revenueIncreasePercent: 18,
  maintenanceSavingsPercent: 32,
  avgMaintenanceCostPerVehicle: 12000,
};

export const roiMethodology = {
  dailyRateExplanation: 'Based on average exotic rental rates across major US markets (Miami, LA, Las Vegas, NYC).',
  utilizationExplanation: 'Typical exotic car fleet utilization, accounting for seasonality and premium booking windows.',
  revenueIncreaseExplanation: 'AI-powered pricing optimization identifies demand patterns and optimal pricing windows.',
  maintenanceSavingsExplanation: 'Predictive maintenance reduces emergency repairs and extends vehicle lifespan.',
  disclaimer: 'Results vary based on fleet composition, location, and market conditions. Estimates only.',
};

export const timeSavingsDefaults = {
  hoursPerVehiclePerWeek: 2.5,
  hourlyAdminRate: 45,
  tasksAutomated: [
    { task: 'Price updates & optimization',   hoursSaved: 0.8 },
    { task: 'Booking management & scheduling', hoursSaved: 0.6 },
    { task: 'Document tracking & renewals',    hoursSaved: 0.4 },
    { task: 'Customer communications',         hoursSaved: 0.4 },
    { task: 'Reporting & analytics',           hoursSaved: 0.3 },
  ],
};

// Launch pricing messaging
export const launchPricingMessage = 'Launch pricing — rates lock in for the lifetime of your subscription. Increases planned for 2027.';

export const competitiveAdvantages = {
  vsTuro:    { feePercent: 25, ourFeePercent: 0, headline: 'Keep 100% of your direct-booking revenue, own your customers' },
  vsHQRental: { theirPrice: 150, headline: 'Per-vehicle pricing with AI included — no per-feature add-ons' },
  vsManual:   { hoursPerWeekManual: 15, headline: 'Replace spreadsheets with automation' },
  vsCustomEnterprise: { ourCost: 21000, theirCost: 100000, implementationTime: '7 days vs 6–12 months' },
};
