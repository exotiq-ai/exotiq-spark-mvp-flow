import { useMemo } from 'react';

export interface DemoStep {
  id: string;
  module: string;
  tab?: string;
  tabSelector?: string;
  selector?: string;
  narration: string;
  subtitle: string;
  duration: number; // ms fallback if TTS fails — calibrated to ~150 wpm
  zoomLevel?: number;
  highlight?: boolean;
}

export const useDemoScript = () => {
  return useMemo<DemoStep[]>(() => [
    {
      id: 'intro',
      module: 'dashboard',
      narration: "Welcome to Exotiq — your all-in-one rental fleet command center. I'm Rari, your AI assistant. Let me show you what a fully running operation looks like.",
      subtitle: "Welcome to Exotiq — your fleet command center.",
      duration: 7000,
    },
    {
      id: 'dashboard-banner',
      module: 'dashboard',
      selector: '[data-tour="revenue-widget"]',
      narration: "Here's your dashboard. The Ferrari F8 Tributo just went out on a weekend rental, and the Lamborghini Urus is pulling in strong midweek revenue. Everything updates in real time.",
      subtitle: "Live revenue from your fleet — updated in real time.",
      duration: 7500,
      zoomLevel: 1.2,
      highlight: true,
    },
    {
      id: 'pulse-intro',
      module: 'pulse',
      narration: "Pulse is your analytics engine. Your fleet is running at 78% utilization this month — the McLaren 765LT has been your top earner.",
      subtitle: "Pulse — fleet analytics & utilization.",
      duration: 6500,
    },
    {
      id: 'pulse-snapshot',
      module: 'pulse',
      selector: '[data-tour="fleet-snapshot"]',
      narration: "The fleet snapshot gives you key metrics at a glance — vehicles out, utilization rate, and average daily rate across all six vehicles.",
      subtitle: "Fleet snapshot with key metrics.",
      duration: 6500,
      zoomLevel: 1.3,
      highlight: true,
    },
    {
      id: 'book-intro',
      module: 'book',
      narration: "Book is where you manage reservations, customers, and payments. Everything you need to run day-to-day operations.",
      subtitle: "Book — reservations, CRM, payments.",
      duration: 6000,
    },
    {
      id: 'book-calendar',
      module: 'book',
      tabSelector: '[data-tab="calendar"]',
      narration: "The calendar shows your bookings visually. Notice the Rolls-Royce Cullinan is booked solid through the weekend. Drag to create, click to edit.",
      subtitle: "Visual booking calendar — drag to create.",
      duration: 7000,
      zoomLevel: 1.2,
    },
    {
      id: 'book-crm',
      module: 'book',
      tabSelector: '[data-tab="customers"]',
      narration: "Your customer database tracks every renter — their booking history, documents, insurance status, and lifetime value.",
      subtitle: "Complete customer relationship management.",
      duration: 6000,
    },
    {
      id: 'book-payments',
      module: 'book',
      tabSelector: '[data-tab="payments"]',
      narration: "Payment tracking keeps your cash flow crystal clear. Record deposits, track balances, and see who owes what — all in one place.",
      subtitle: "Payment tracking & cash flow.",
      duration: 5500,
    },
    {
      id: 'motoriq-intro',
      module: 'motoriq',
      narration: "MotorIQ is your AI pricing engine. It analyzes market data and local events to optimize your rates. The Porsche GT3 RS could be earning 20% more during race weekends.",
      subtitle: "MotorIQ — AI-powered pricing intelligence.",
      duration: 7000,
    },
    {
      id: 'vault-intro',
      module: 'vault',
      narration: "Vault keeps all your documents organized — rental agreements, insurance certificates, vehicle registrations. Everything stays compliant and audit-ready.",
      subtitle: "Vault — documents & compliance.",
      duration: 6500,
    },
    {
      id: 'vault-compliance',
      module: 'vault',
      selector: '[data-tour="compliance-overview"]',
      narration: "Your compliance score tells you at a glance if any documents are expiring or missing. Stay ahead of deadlines automatically.",
      subtitle: "Compliance score & expiry tracking.",
      duration: 6000,
      zoomLevel: 1.3,
      highlight: true,
    },
    {
      id: 'fleet-intro',
      module: 'fleet',
      narration: "The Fleet page is your vehicle inventory. Here you can see the McLaren GT, the Cullinan, and the rest of your lineup — with photos, maintenance history, and status for each.",
      subtitle: "Fleet — vehicle inventory management.",
      duration: 7000,
    },
    {
      id: 'rari-intro',
      module: 'dashboard',
      selector: '[data-tour="rari-button"]',
      narration: "And of course, I'm always here. Tap the Rari button anytime to ask questions, get insights, or run actions by voice.",
      subtitle: "Rari — your AI assistant, always available.",
      duration: 6000,
      zoomLevel: 1.2,
      highlight: true,
    },
    {
      id: 'outro',
      module: 'dashboard',
      narration: "That's the tour! Now let's set up your own fleet. Everything you just saw will look exactly like this once your vehicles are in the system.",
      subtitle: "Now let's set up your fleet!",
      duration: 5500,
    },
  ], []);
};
