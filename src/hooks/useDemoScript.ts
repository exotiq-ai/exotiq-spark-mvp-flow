import { useMemo } from 'react';

export interface DemoStep {
  id: string;
  module: string;
  tab?: string;
  tabSelector?: string;
  selector?: string;
  narration: string;
  subtitle: string;
  duration: number; // ms fallback if TTS fails
  zoomLevel?: number; // 1 = normal, 1.5 = zoom in
  highlight?: boolean;
}

export const useDemoScript = () => {
  return useMemo<DemoStep[]>(() => [
    {
      id: 'intro',
      module: 'dashboard',
      narration: "Welcome to Exotiq — your all-in-one rental fleet command center. I'm Rari, your AI assistant, and I'll walk you through everything.",
      subtitle: "Welcome to Exotiq — your fleet command center.",
      duration: 6000,
    },
    {
      id: 'dashboard-banner',
      module: 'dashboard',
      selector: '[data-tour="revenue-widget"]',
      narration: "Your dashboard gives you a live snapshot of revenue, utilization, and key metrics — all computed from real booking data.",
      subtitle: "Live revenue & metrics overview.",
      duration: 5000,
      zoomLevel: 1.2,
      highlight: true,
    },
    {
      id: 'pulse-intro',
      module: 'pulse',
      narration: "Pulse is your analytics engine. Real-time fleet performance, revenue trends, and utilization breakdowns — all in one place.",
      subtitle: "Pulse — real-time fleet analytics.",
      duration: 5000,
    },
    {
      id: 'pulse-snapshot',
      module: 'pulse',
      selector: '[data-tour="fleet-snapshot"]',
      narration: "The fleet snapshot shows you key metrics at a glance — how many vehicles are out, your utilization rate, and average daily rate.",
      subtitle: "Fleet snapshot with key metrics.",
      duration: 5000,
      zoomLevel: 1.3,
      highlight: true,
    },
    {
      id: 'book-intro',
      module: 'book',
      narration: "Book is where you manage reservations, customers, and payments. Everything you need to run day-to-day operations.",
      subtitle: "Book — reservations, CRM, payments.",
      duration: 5000,
    },
    {
      id: 'book-calendar',
      module: 'book',
      tabSelector: '[data-tab="calendar"]',
      narration: "The calendar view shows all your bookings laid out visually. Drag to create, click to edit — it's that simple.",
      subtitle: "Visual calendar for all bookings.",
      duration: 5000,
      zoomLevel: 1.2,
    },
    {
      id: 'book-crm',
      module: 'book',
      tabSelector: '[data-tab="crm"]',
      narration: "Your customer database tracks every renter — their history, documents, insurance status, and lifetime value.",
      subtitle: "Complete customer relationship management.",
      duration: 5000,
    },
    {
      id: 'book-payments',
      module: 'book',
      tabSelector: '[data-tab="payments"]',
      narration: "Payment tracking keeps your cash flow crystal clear. Record deposits, track balances, and see who owes what.",
      subtitle: "Payment tracking & cash flow.",
      duration: 5000,
    },
    {
      id: 'motoriq-intro',
      module: 'motoriq',
      narration: "MotorIQ is your AI-powered pricing and fleet intelligence engine. It analyzes market data to optimize your rates.",
      subtitle: "MotorIQ — AI pricing intelligence.",
      duration: 5000,
    },
    {
      id: 'vault-intro',
      module: 'vault',
      narration: "Vault keeps all your documents organized — rental agreements, insurance certificates, vehicle registrations. Everything stays compliant.",
      subtitle: "Vault — documents & compliance.",
      duration: 5000,
    },
    {
      id: 'vault-compliance',
      module: 'vault',
      selector: '[data-tour="compliance-overview"]',
      narration: "Your compliance score tells you at a glance if any documents are expiring or missing. Stay ahead of deadlines.",
      subtitle: "Compliance score & expiry tracking.",
      duration: 5000,
      zoomLevel: 1.3,
      highlight: true,
    },
    {
      id: 'fleet-intro',
      module: 'fleet',
      narration: "The Fleet page is your vehicle inventory. Add vehicles one by one or bulk import from a CSV. Track photos, maintenance, and status.",
      subtitle: "Fleet — vehicle inventory management.",
      duration: 5000,
    },
    {
      id: 'rari-intro',
      module: 'dashboard',
      selector: '[data-tour="rari-fab"]',
      narration: "And of course, I'm always here. Tap the Rari button anytime to ask questions, get insights, or run actions by voice.",
      subtitle: "Rari — your AI assistant, always available.",
      duration: 5000,
      zoomLevel: 1.2,
      highlight: true,
    },
    {
      id: 'outro',
      module: 'dashboard',
      narration: "That's the tour! You're all set to manage your fleet like a pro. Explore freely — I'm just a tap away if you need anything.",
      subtitle: "You're all set! Explore freely.",
      duration: 5000,
    },
  ], []);
};
