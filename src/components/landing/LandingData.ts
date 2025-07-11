import { 
  TrendingUp, 
  Calendar, 
  Shield, 
  Brain, 
  BarChart3
} from "lucide-react";

export const features = [
  {
    icon: TrendingUp,
    title: "MotorIQ",
    description: "AI-powered fleet profitability engine with dynamic pricing optimization",
    color: "text-success"
  },
  {
    icon: BarChart3,
    title: "Pulse",
    description: "Live analytics dashboard with predictive insights and forecasting",
    color: "text-primary"
  },
  {
    icon: Calendar,
    title: "Book",
    description: "Direct booking tools with seamless calendar management",
    color: "text-accent"
  },
  {
    icon: Shield,
    title: "Vault",
    description: "Intelligent compliance hub with automated document tracking",
    color: "text-warning"
  },
  {
    icon: Brain,
    title: "Core",
    description: "Smart command center with AI-powered alerts and insights",
    color: "text-destructive"
  }
];

export const pricingPlans = [
  {
    name: "Starter",
    price: "$49",
    vehicles: "5 vehicles",
    features: ["Basic analytics", "Document management", "Email support"],
    popular: false
  },
  {
    name: "Growth",
    price: "$99",
    vehicles: "20 vehicles",
    features: ["Advanced analytics", "AI insights", "Priority support", "Custom branding"],
    popular: true
  },
  {
    name: "Pro",
    price: "$199",
    vehicles: "50 vehicles",
    features: ["Full AI suite", "API access", "White-label solution", "Dedicated support"],
    popular: false
  },
  {
    name: "Enterprise",
    price: "Custom",
    vehicles: "200+ vehicles",
    features: ["Custom integrations", "Dedicated account manager", "SLA guarantee"],
    popular: false
  }
];

export const testimonials = [
  {
    name: "Sarah Chen",
    role: "Fleet Owner",
    company: "Luxury Drives Miami",
    content: "ExotIQ transformed our operations. We increased profits by 40% in just 3 months.",
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