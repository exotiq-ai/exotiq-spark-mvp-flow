// Stripe Price IDs
export const STRIPE_PRICES = {
  starter: {
    monthly: 'price_1ShjP0HO7nC3pJiP4ExcElvZ',
    annual: 'price_1ShjP6HO7nC3pJiP9QBawM60',
  },
  professional: {
    monthly: 'price_1ShjP8HO7nC3pJiPQyJ3HFB4',
    annual: 'price_1ShjPBHO7nC3pJiP6KR4QvWc',
  },
  business: {
    monthly: 'price_1ShjPCHO7nC3pJiP3e6FjmV9',
    annual: 'price_1ShjPEHO7nC3pJiPdIX5VJuc',
  },
  enterprise: {
    monthly: 'price_1ShjPFHO7nC3pJiPDFbyAUZF',
    annual: 'price_1ShjPHHO7nC3pJiPoU8XyhuH',
  },
} as const;

export interface PricingTier {
  id: 'starter' | 'professional' | 'business' | 'enterprise';
  name: string;
  founderPrice: number;
  regularPrice: number;
  vehicleRange: string;
  minVehicles: number;
  maxVehicles: number;
  popular: boolean;
  features: string[];
  aiForecasting: string;
  apiAccess: boolean;
  locations: string;
  supportSLA: string;
  onboardingOffer: string;
}

export const pricingTiers: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    founderPrice: 29,
    regularPrice: 39,
    vehicleRange: '1-10 vehicles',
    minVehicles: 1,
    maxVehicles: 10,
    popular: false,
    features: [
      'Complete fleet dashboard',
      'Document vault with auto-alerts',
      'Basic booking calendar',
      'Customer CRM',
      'Email support',
    ],
    aiForecasting: '7-day',
    apiAccess: false,
    locations: '1 location',
    supportSLA: 'Email (48hr)',
    onboardingOffer: 'Free white-glove setup (annual)',
  },
  {
    id: 'professional',
    name: 'Professional',
    founderPrice: 24,
    regularPrice: 34,
    vehicleRange: '11-30 vehicles',
    minVehicles: 11,
    maxVehicles: 30,
    popular: true,
    features: [
      'Everything in Starter, plus:',
      'MotorIQ AI pricing engine',
      'Advanced analytics & reports',
      'Multi-location support',
      'Priority chat support',
      'Custom integrations',
    ],
    aiForecasting: '30-day',
    apiAccess: true,
    locations: 'Up to 3 locations',
    supportSLA: 'Chat (24hr)',
    onboardingOffer: '50% off setup (annual)',
  },
  {
    id: 'business',
    name: 'Business',
    founderPrice: 19,
    regularPrice: 29,
    vehicleRange: '31-75 vehicles',
    minVehicles: 31,
    maxVehicles: 75,
    popular: false,
    features: [
      'Everything in Professional, plus:',
      'Full AI suite with Rari copilot',
      'White-label booking portal',
      'Dedicated success manager',
      'Phone support',
      'SLA guarantee',
    ],
    aiForecasting: '90-day',
    apiAccess: true,
    locations: 'Unlimited locations',
    supportSLA: 'Phone (4hr)',
    onboardingOffer: '50% off setup (annual)',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    founderPrice: 16,
    regularPrice: 24,
    vehicleRange: '76+ vehicles',
    minVehicles: 76,
    maxVehicles: 999,
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
    onboardingOffer: 'Custom enterprise setup',
  },
];

export const faqItems = [
  {
    question: 'What happens after the 14-day free trial?',
    answer: 'Your trial converts to a paid subscription at the founder rate you locked in. You can cancel anytime during the trial with no charges. Credit card is required upfront to lock in founder pricing, but you will not be charged until day 15.',
  },
  {
    question: 'Is this pricing per vehicle or per account?',
    answer: 'Pricing is per vehicle per month. For example, a 15-vehicle fleet on the Professional plan would be $24 x 15 = $360/month. Volume discounts are built into the tier structure.',
  },
  {
    question: 'What is founder pricing and how long does it last?',
    answer: 'Founder pricing is our early-adopter discount, available until March 31, 2025 or until 250 spots are filled. Once you lock in founder pricing, your rate stays the same forever, even as we add new features and raise prices for new customers.',
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
    answer: 'Annual prepay customers with 1-10 vehicles get free white-glove onboarding. Larger fleets on annual plans get 50% off setup. Monthly billing includes a standard $2,500 onboarding fee, which covers data migration, training, and dedicated setup support.',
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

export const roiDefaults = {
  avgDailyRate: 500,
  avgUtilization: 65,
  revenueIncreasePercent: 25,
  maintenanceSavingsPercent: 38,
  avgMaintenanceCostPerVehicle: 3000,
};

export const founderDeadline = new Date('2025-03-31T23:59:59');
export const founderSpotsTotal = 250;
export const founderSpotsRemaining = 73;
