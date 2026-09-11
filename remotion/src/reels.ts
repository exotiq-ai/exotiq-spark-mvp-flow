export type Rect = { x: number; y: number; w: number; h: number };

export type ReelDef = {
  id: string;
  title: string;
  shot: string;
  from: Rect;
  to: Rect;
  hookText: string;
  payoffText: string;
  ctaKeyword: string;
  bodyLines: string[];
  ctaLine: string;
};

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const REELS: ReelDef[] = [
  {
    id: "double-booking",
    title: "Double-booking killer",
    shot: "fleet.png",
    from: r(300, 220, 1400, 787),
    to: r(520, 300, 1000, 562),
    hookText: "Same car. Two renters. Saturday.",
    payoffText: "One fleet. One truth.",
    ctaKeyword: "TRUTH",
    bodyLines: [
      "You pull a car for service.",
      "I make it unbookable. Instantly.",
      "Calendar. Booking site. Your team's phones. One answer, every surface Exotiq runs.",
      "No apology call. No comped weekend.",
      "You never explain a conflict to a customer again.",
    ],
    ctaLine: "Comment TRUTH and I'll DM you the walkthrough.",
  },
  {
    id: "prices-itself",
    title: "Prices itself",
    shot: "motoriq_pricing.png",
    from: r(320, 140, 1360, 765),
    to: r(480, 520, 1100, 618),
    hookText: "Same rate Tuesday and Saturday?",
    payoffText: "Priced for today. Not last month.",
    ctaKeyword: "PRICE",
    bodyLines: [
      "Race weekend? Convention in town? I already know.",
      "I price every car for the day it's actually in. Not the rate you set in March.",
      "You review. One click. The whole fleet moves.",
      "More per car. No spreadsheet. No late-night rate edits.",
    ],
    ctaLine: "Comment PRICE and I'll DM you the walkthrough.",
  },
  {
    id: "money-not-limbo",
    title: "Money, not limbo",
    shot: "payments2.png",
    from: r(620, 90, 1200, 675),
    to: r(720, 260, 1000, 562),
    hookText: "Who still owes you a deposit?",
    payoffText: "Money. Not limbo.",
    ctaKeyword: "MONEY",
    bodyLines: [
      "Deposit. Balance. Hold. I tie every one to its booking.",
      "Paid, pending, overdue. You see which is which before the customer calls.",
      "Stripe underneath. Every charge is real money, not a note in a spreadsheet.",
      "No chasing. No guessing. No limbo.",
    ],
    ctaLine: "Comment MONEY and I'll DM you the whole flow.",
  },
];
