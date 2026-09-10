export type Rect = { x: number; y: number; w: number; h: number };

export type Segment = {
  audio: string;
  caption: string;
  shot?: string;
  from?: Rect;
  to?: Rect;
  kind?: "brand-open" | "brand-close";
  /** extra frames of silence after the line finishes */
  pad?: number;
  /** audio length in seconds (measured) */
  len: number;
};

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const SEGMENTS: Segment[] = [
  {
    audio: "00.mp3",
    len: 2.6,
    caption: "Running an exotic fleet shouldn't feel like guesswork.",
    shot: "dashboard_clean.png",
    from: r(400, 80, 1240, 698),
    to: r(440, 100, 1120, 630),
    pad: 24,
  },
  {
    audio: "14.mp3",
    len: 3.2,
    caption: "Built for operators who rent supercars, not spreadsheets.",
    kind: "brand-open",
    pad: 30,
  },
  {
    audio: "01.mp3",
    len: 3.11,
    caption: "One command center for your entire operation.",
    shot: "dashboard_clean.png",
    from: r(260, 70, 1640, 923),
    to: r(300, 90, 1560, 878),
    pad: 45,
  },
  {
    audio: "02.mp3",
    len: 4.23,
    caption: "Every vehicle. Status, pricing, photos, readiness.",
    shot: "fleet.png",
    from: r(410, 300, 1420, 799),
    to: r(430, 330, 1300, 731),
    pad: 42,
  },
  {
    audio: "03.mp3",
    len: 4.13,
    caption: "Mark a car out of service — it stops being bookable, instantly.",
    shot: "fleet.png",
    from: r(430, 335, 980, 551),
    to: r(445, 350, 860, 484),
    pad: 42,
  },
  {
    audio: "04.mp3",
    len: 2.6,
    caption: "Bookings, pickups and returns on a single calendar.",
    shot: "bookings.png",
    from: r(420, 90, 1360, 765),
    to: r(440, 130, 1260, 709),
    pad: 30,
  },
  {
    audio: "05.mp3",
    len: 2.51,
    caption: "Conflicts caught before they cost you a customer.",
    shot: "bookings_calendar.png",
    from: r(440, 255, 1300, 731),
    to: r(445, 262, 1080, 608),
    pad: 42,
  },
  {
    audio: "06.mp3",
    len: 2.83,
    caption: "MotorIQ reads local demand and event pressure…",
    shot: "motoriq_demand.png",
    from: r(440, 160, 1320, 743),
    to: r(455, 185, 1220, 686),
    pad: 24,
  },
  {
    audio: "07.mp3",
    len: 2.74,
    caption: "…then prices every car for the day it's actually in.",
    shot: "motoriq_pricing.png",
    from: r(440, 160, 1320, 743),
    to: r(455, 200, 1220, 686),
    pad: 24,
  },
  {
    audio: "08.mp3",
    len: 2.04,
    caption: "One click applies it across the fleet.",
    shot: "motoriq_pricing.png",
    from: r(450, 660, 1280, 720),
    to: r(470, 700, 1180, 664),
    pad: 42,
  },
  {
    audio: "09.mp3",
    len: 3.62,
    caption: "Your customers, their history, their lifetime value.",
    shot: "customers_vip.png",
    from: r(420, 85, 1320, 743),
    to: r(440, 100, 1240, 698),
    pad: 24,
  },
  {
    audio: "15.mp3",
    len: 3.58,
    caption: "Repeat renters, VIP tiers, every note in one profile.",
    shot: "customers_vip.png",
    from: r(450, 390, 1290, 726),
    to: r(465, 400, 1200, 675),
    pad: 42,
  },
  {
    audio: "10.mp3",
    len: 2.79,
    caption: "Take payments, deposits and holds with Stripe built in.",
    shot: "payments2.png",
    from: r(700, 90, 1080, 608),
    to: r(715, 105, 1000, 563),
    pad: 24,
  },
  {
    audio: "11.mp3",
    len: 1.86,
    caption: "Money in your account, not in limbo.",
    shot: "payments2.png",
    from: r(1140, 110, 780, 439),
    to: r(1160, 125, 720, 405),
    pad: 42,
  },
  {
    audio: "16.mp3",
    len: 2.69,
    caption: "Marketplace ready — so new demand finds your cars.",
    shot: "marketplace.png",
    from: r(700, 90, 1080, 608),
    to: r(715, 130, 1000, 563),
    pad: 42,
  },
  {
    audio: "12.mp3",
    len: 3.25,
    caption: "Less admin. Higher utilization. More revenue per car.",
    shot: "pulse2.png",
    from: r(430, 150, 1320, 743),
    to: r(445, 170, 1230, 692),
    pad: 45,
  },
  {
    audio: "13.mp3",
    len: 1.72,
    caption: "Exotiq. Your fleet, commanded.",
    kind: "brand-close",
    pad: 80,
  },
];

export const LEAD_IN = 22; // frames of black/brand breath before narration starts
