import { CalendarCheck, CreditCard, Building2, LineChart } from "lucide-react";

const proofPoints = [
  {
    icon: LineChart,
    title: "Pricing that keeps up with demand",
    description:
      "Rates are suggested per vehicle per day from real demand signals, and you stay in control of every override.",
  },
  {
    icon: CalendarCheck,
    title: "A car out of service can't be booked",
    description:
      "Maintenance, tasks and blocked dates all feed the same availability rules, so double bookings don't happen.",
  },
  {
    icon: CreditCard,
    title: "Money you can follow end to end",
    description:
      "Deposits, holds, payment links, refunds and payouts all run through Stripe and stay attached to the booking.",
  },
  {
    icon: Building2,
    title: "One place for every location",
    description:
      "Fleet, staff, tax rates and documents stay separated by location while you work from a single command center.",
  },
];

export const ProofSection = () => {
  return (
    <section id="proof" className="px-4 py-24 sm:px-6 lg:py-28">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p className="mb-4 font-medium text-primary">Built for real operations</p>
          <h2 className="mb-5 font-brand text-3xl font-bold tracking-tight sm:text-4xl">
            What the platform actually does
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            No dashboards for the sake of dashboards. Every part of Exotiq exists to protect a
            booking, a car, or a payment.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {proofPoints.map((point) => (
            <div
              key={point.title}
              className="rounded-2xl border border-border/60 bg-card p-8 transition-colors hover:border-primary/30"
            >
              <point.icon className="mb-4 h-7 w-7 text-primary" />
              <h3 className="mb-2 font-brand text-lg font-semibold">{point.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
