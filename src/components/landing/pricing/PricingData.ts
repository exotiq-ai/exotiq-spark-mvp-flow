// Stripe Price IDs - Hybrid Pricing Model
export const STRIPE_PRICES = {
  starter: {
    monthly: 'price_1TK1CDQn5o30XCWdYrdXqWoi',
    annual: 'price_1TK1CJQn5o30XCWdTRIlTFT9',
  },
  professional: {
    monthly: 'price_1TK1COQn5o30XCWdvm3jVgGX',
    annual: 'price_1TK1CPQn5o30XCWdIFgGk2oK',
  },
  business: {
    monthly: 'price_1TK1CUQn5o30XCWdubyD6CKp',
    annual: 'price_1TK1CVQn5o30XCWd8XU5IF0t',
  },
  enterprise: {
    monthly: 'price_1TK1CaQn5o30XCWdiGFjpsXh',
    annual: 'price_1TK1CbQn5o30XCWdpyWNFfIg',
  },
} as const;

export interface PricingTier {
  id: 'starter' | 'professional' | 'business' | 'enterprise';
  name: string;
  price: number; // Monthly flat price
  priceType: 'per-vehicle' | 'flat';
  perVehicleRate?: number; // For starter tier
  minPrice?: number; // For starter tier minimum
  vehicleRange: string;
  maxVehicles: number;
  overageRate?: number; // Per vehicle overage fee
  popular: boolean;
  features: string[];
  aiForecasting: string;
  apiAccess: boolean;
  locations: string;
  supportSLA: string;
  valueProposition: string;
}

export const pricingTiers: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 79, // Minimum price
    priceType: 'per-vehicle',
    perVehicleRate: 29,
    minPrice: 79,
    vehicleRange: '1-10 vehicles',
    maxVehicles: 10,
    popular: false,
    features: [
      'Complete fleet dashboard',
      'Document vault with auto-alerts',
      'Basic booking calendar',
      'Customer CRM',
      'Email support (48hr)',
    ],
    aiForecasting: '7-day',
    apiAccess: false,
    locations: '1 location',
    supportSLA: 'Email (48hr)',
    valueProposition: 'Perfect for small fleets just getting started',
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 399,
    priceType: 'flat',
    vehicleRange: 'Up to 25 vehicles',
    maxVehicles: 25,
    overageRate: 22,
    popular: true,
    features: [
      'Everything in Starter, plus:',
      'MotorIQ AI pricing engine',
      'Advanced analytics & reports',
      'Multi-location support (up to 3)',
      'Priority chat support (24hr)',
      'Custom integrations',
    ],
    aiForecasting: '30-day',
    apiAccess: true,
    locations: 'Up to 3 locations',
    supportSLA: 'Chat (24hr)',
    valueProposition: 'Most popular for growing operations',
  },
  {
    id: 'business',
    name: 'Business',
    price: 899,
    priceType: 'flat',
    vehicleRange: 'Up to 75 vehicles',
    maxVehicles: 75,
    overageRate: 18,
    popular: false,
    features: [
      'Everything in Professional, plus:',
      'Full AI suite with Rari copilot',
      'White-label booking portal',
      'Dedicated success manager',
      'Phone support (4hr)',
      'SLA guarantee',
    ],
    aiForecasting: '90-day',
    apiAccess: true,
    locations: 'Unlimited locations',
    supportSLA: 'Phone (4hr)',
    valueProposition: 'For established multi-location fleets',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 1799,
    priceType: 'flat',
    vehicleRange: 'Up to 150 vehicles',
    maxVehicles: 150,
    overageRate: 15,
    popular: false,
    features: [
      'Everything in Business, plus:',
      'Custom AI model training',
      'Dedicated infrastructure',
      'Custom integrations & API',
      'Quarterly business reviews',
      'Enterprise SLA (99.9%)',
    ],
    aiForecasting: '365-day',
    apiAccess: true,
    locations: 'Unlimited + custom',
    supportSLA: 'Dedicated (1hr)',
    valueProposition: 'Full-service for large operations',
  },
];

export const faqItems = [
  {
    question: 'What happens after the 14-day free trial?',
    answer: 'Your trial converts to a paid subscription. You can cancel anytime during the trial with no charges. Credit card is required upfront to lock in founder pricing, but you will not be charged until day 15.',
  },
  {
    question: 'How does pricing work?',
    answer: 'Starter is $29/vehicle/month with a $79 minimum. Professional ($399), Business ($899), and Enterprise ($1,799) are flat monthly rates with included vehicle limits. If you exceed your limit, overage rates apply ($22, $18, or $15 per additional vehicle).',
  },
  {
    question: 'What are founder pricing and how long does it last?',
    answer: 'Founder pricing is our early-adopter discount, available until March 31, 2026 or until 250 spots are filled. Once you lock in founder pricing, your rate stays the same forever, even as we add new features and raise prices.',
  },
  {
    question: 'Can I switch plans later?',
    answer: 'Absolutely! You can upgrade or downgrade at any time. When upgrading, you get immediate access to new features. When downgrading, changes take effect at your next billing cycle.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) and ACH bank transfers for annual plans. Enterprise customers can also pay via invoice with NET-30 terms.',
  },
  {
    question: 'Is there a setup fee?',
    answer: 'No setup fees! We include white-glove onboarding with all plans - data migration, training, and dedicated setup support are included in your subscription.',
  },
  {
    question: 'What if I need custom features or integrations?',
    answer: 'Our Business and Enterprise plans include custom integrations. Contact our sales team to discuss your specific needs. We have built integrations with major rental platforms, accounting systems, and telematics providers.',
  },
];

export const coreFeatures = [
  {
    title: 'Core Fleet Dashboard',
    description: 'Real-time fleet overview with vehicle status, availability, and key metrics at a glance',
  },
  {
    title: 'Pulse Analytics',
    description: 'Revenue tracking, utilization reports, and performance insights across your entire fleet',
  },
  {
    title: 'Book Calendar',
    description: 'Drag-and-drop booking management with conflict detection and customer notifications',
  },
  {
    title: 'Vault Document Management',
    description: 'Secure storage for insurance, registration, and maintenance documents with expiry alerts',
  },
  {
    title: 'Customer CRM',
    description: 'Complete customer profiles with booking history, preferences, and communication logs',
  },
  {
    title: 'MotorIQ AI Engine',
    description: 'AI-powered pricing recommendations that optimize your rates based on demand and competition',
  },
];

// ROI Calculator defaults based on exotic car rental industry benchmarks
export const roiDefaults = {
  avgDailyRate: 1800,
  avgUtilization: 48,
  revenueIncreasePercent: 22,
  maintenanceSavingsPercent: 32,
  avgMaintenanceCostPerVehicle: 12000,
};

export const roiMethodology = {
  dailyRateExplanation: 'Based on average exotic rental rates for Ferrari, Lamborghini, McLaren, and Porsche models across major US markets (Miami, LA, Las Vegas, NYC)',
  utilizationExplanation: 'Reflects typical exotic car fleet utilization, accounting for seasonal demand, premium pricing barriers, and extended booking windows',
  revenueIncreaseExplanation: 'AI-powered pricing optimization identifies demand patterns, competitor rates, and optimal pricing windows to maximize rental revenue',
  maintenanceSavingsExplanation: 'Predictive maintenance alerts and scheduling reduce emergency repairs and extend vehicle lifespan, typical for high-performance exotic vehicles',
  disclaimer: 'Results may vary based on fleet composition, location, and market conditions. Calculator provides estimates based on industry benchmarks.',
};

// Time savings defaults for operational efficiency
export const timeSavingsDefaults = {
  hoursPerVehiclePerWeek: 2.5, // Hours saved per vehicle per week on admin tasks
  hourlyAdminRate: 45, // Average hourly rate for admin work
  tasksAutomated: [
    { task: 'Price updates & optimization', hoursSaved: 0.8 },
    { task: 'Booking management & scheduling', hoursSaved: 0.6 },
    { task: 'Document tracking & renewals', hoursSaved: 0.4 },
    { task: 'Customer communications', hoursSaved: 0.4 },
    { task: 'Reporting & analytics', hoursSaved: 0.3 },
  ],
};

export const founderDeadline = new Date('2026-03-31T23:59:59');
export const founderSpotsTotal = 250;
export const founderSpotsRemaining = 73;

// Competitive positioning data
export const competitiveAdvantages = {
  vsTuro: {
    feePercent: 25,
    ourFeePercent: 2.5,
    headline: 'Keep 97.5% of your revenue, own your customers',
  },
  vsHQRental: {
    theirPrice: 150,
    headline: 'Same features, but with AI that pays for itself',
  },
  vsManual: {
    hoursPerWeekManual: 15,
    headline: 'Replace spreadsheets with automation',
  },
  vsCustomEnterprise: {
    ourCost: 21000,
    theirCost: 100000,
    implementationTime: '7 days vs 6-12 months',
  },
};
