import { 
  Sparkles, 
  CalendarDays, 
  ShieldCheck, 
  Zap, 
  BarChart4
} from "lucide-react";

export const features = [
  {
    icon: Sparkles,
    title: "MotorIQ",
    description: "AI-powered revenue optimization that learns your market dynamics and automatically adjusts pricing for maximum profitability across your entire fleet",
    color: "text-success"
  },
  {
    icon: BarChart4,
    title: "Pulse",
    description: "Real-time operational intelligence with predictive analytics that forecasts demand trends and identifies growth opportunities before they happen",
    color: "text-primary"
  },
  {
    icon: CalendarDays,
    title: "Book",
    description: "Seamless direct booking experience that eliminates platform fees while giving you complete control over customer relationships and pricing strategy",
    color: "text-accent"
  },
  {
    icon: ShieldCheck,
    title: "Vault",
    description: "Automated compliance management that tracks insurance, registrations, and maintenance schedules, preventing costly oversights and reducing administrative burden",
    color: "text-warning"
  },
  {
    icon: Zap,
    title: "Core",
    description: "Intelligent command center that automates routine operations and surfaces critical insights, letting you focus on strategic growth instead of daily tasks",
    color: "text-secondary"
  }
];

export const pricingPlans = [
  {
    name: "Pro",
    price: "$39",
    vehicles: "1–15 vehicles · per vehicle/mo",
    features: ["All features included", "MotorIQ AI pricing", "Email & chat support"],
    popular: true,
  },
  {
    name: "Business",
    price: "$29",
    vehicles: "16–50 vehicles · per vehicle/mo",
    features: ["Everything in Pro", "Priority support (4hr)", "Up to 5 locations", "White-label marketplace"],
    popular: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    vehicles: "51+ vehicles",
    features: ["Custom AI training", "Dedicated CSM", "Custom integrations & SLA"],
    popular: false,
  },
];

export const testimonials = [
  {
    name: "Sarah Chen",
    role: "Fleet Owner",
    company: "Luxury Drives Miami",
    content: "Exotiq transformed our operations. We increased profits by 40% in just 3 months.",
    rating: 5
  },
  {
    name: "Marcus Rodriguez",
    role: "Rental Entrepreneur",
    company: "Elite Car Share",
    content: "The AI insights are game-changing. It's like having a business consultant available 24/7.",
    rating: 5
  },
  {
    name: "Emma Thompson",
    role: "Operations Manager",
    company: "Premium Auto Collective",
    content: "Finally, a platform that understands the exotic rental business. Absolutely essential.",
    rating: 5
  }
];