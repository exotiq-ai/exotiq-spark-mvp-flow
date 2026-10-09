/**
 * Voice layer: turns MotorIQ's objects into something a voice agent can say as is.
 *
 * The agent should not re-derive or re-word numbers. It reads `brief.opening` and then the `say` of each item, and it can
 * answer direct questions from `brief.facts` (one plain sentence each). Everything is built from the same snapshot the
 * screens render, so what Rari says always matches what the tenant sees.
 */
import type { MotorIQSnapshot } from "./types";

/** "America/New_York" becomes "New York". */
export const placeName = (tz: string) => (tz.split("/").pop() ?? tz).replace(/_/g, " ");

/** "Saturday, October 10 at 6:42 PM, Phoenix time", in the tenant's own zone. */
export function spokenNow(nowMs: number, tz: string): string {
  const when = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(nowMs);
  return `${when}, ${placeName(tz)} time`;
}

/** Make a sentence safe for text-to-speech: dollars, percents, signs and arrows spoken the way people say them. */
export function forVoice(text: string): string {
  return text
    .replace(/\$([\d,]+(?:\.\d+)?)/g, "$1 dollars")
    // ranges first ("+25-30%" must not become "up 25 down 30")
    .replace(/\+(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)%/g, "up $1 to $2 percent")
    .replace(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)%/g, "$1 to $2 percent")
    .replace(/\+(\d+(?:\.\d+)?)%/g, "up $1 percent")
    .replace(/(^|[\s(])-(\d+(?:\.\d+)?)%/g, "$1down $2 percent")
    .replace(/(\d+(?:\.\d+)?)%/g, "$1 percent")
    .replace(/\s*->\s*|\s*→\s*/g, " to ")
    .replace(/÷/g, " divided by ")
    .replace(/&/g, " and ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface VoiceItem {
  id: string;
  say: string;
  /** what the tenant might ask next, so the agent can offer it */
  followUps: string[];
}

export interface VoiceBrief {
  asOf: string;
  /** the tenant's IANA time zone: every day, date and time the agent says is in this zone */
  timeZone: string;
  /** who the agent is when it speaks about this data */
  persona: string;
  /** hard rules for what it may talk about and how */
  rules: string[];
  /** the current local date and time, in words (only when the caller supplies the clock) */
  spokenNow: string | null;
  opening: string;
  items: VoiceItem[];
  /** direct answers to common questions, keyed by topic */
  facts: Record<string, string>;
  /** things the agent must say when asked how sure it is */
  caveats: string[];
}

const pc = (x: number | null | undefined) => (x == null ? "not available" : `${Math.round(x * 100)}%`);

export const RARI_PERSONA =
  "Rari is the tenant's always-on business partner: it knows this operation as well as the owner does and knows how exotic car rental really works " +
  "(pickup pace, utilization, rate integrity, event weekends, turnarounds, deposits, damage and downtime), and it speaks like the best operator in the business: " +
  "short, specific, in plain language, with a clear recommendation.";

export function rariRules(timeZone: string): string[] {
  return [
    "Talk only about this tenant's own data (their cars, bookings, customers, rates, finances, documents, team and events in their markets), across every module, and only to help them run and improve the business.",
    "Never present generic market statistics, other companies' data or numbers you were not given. If you do not have it, say so.",
    `Say every date and time in the tenant's time zone (${placeName(timeZone)}), never UTC.`,
    "Say numbers exactly as given in these strings; do not recalculate or round differently.",
    "Say when data is missing or thin, and how sure the recommendation is.",
    "Never change a rate, booking or any record without an explicit spoken confirmation, and only for people whose role allows it.",
  ];
}

export function buildVoiceBrief(snapshot: MotorIQSnapshot, opts: { maxItems?: number; nowMs?: number } = {}): VoiceBrief {
  const maxItems = opts.maxItems ?? 3;
  const f = snapshot.facts.fleet;
  const facts: Record<string, string> = {
    utilization: forVoice(`Over the last 30 days your fleet was ${pc(f.trailing30.share)} utilized, ${f.trailing30.booked} booked days out of ${f.trailing30.available} available.`),
    nextWeek: forVoice(`The next 7 days are ${pc(f.forward7.share)} booked: ${f.forward7.booked} of ${f.forward7.available} car days.`),
    bookedAhead: forVoice(f.bookedRevenueNext30.value == null
      ? "Nothing is booked yet for the next 30 days."
      : `You have $${f.bookedRevenueNext30.value.toLocaleString("en-US")} already booked for the next 30 days.${f.earnedLast30.value != null ? ` The last 30 days earned $${f.earnedLast30.value.toLocaleString("en-US")}.` : ""}`),
    openDays: `${f.openDays14} car days are open in the next 14 days.`,
  };
  for (const r of snapshot.recommendations) facts[`car:${r.vehicleId}`] = forVoice(r.speakable);

  const caveats = [
    "Everything comes from your own bookings, vehicles and blocked dates.",
    "Event effects are modeled estimates and are not yet measured on your results, so I treat them with care.",
    "When there is not enough data I say so and suggest holding the rate.",
  ];

  const now = opts.nowMs != null ? spokenNow(opts.nowMs, snapshot.timeZone) : null;

  return {
    asOf: snapshot.asOf,
    timeZone: snapshot.timeZone,
    persona: RARI_PERSONA,
    rules: rariRules(snapshot.timeZone),
    spokenNow: now,
    opening: forVoice(`${now ? `It is ${now}. ` : ""}${snapshot.summary}`),
    items: snapshot.insights.slice(0, maxItems).map((i) => ({
      id: i.id,
      say: forVoice(i.speakable),
      followUps: i.actions.map((a) => a.label),
    })),
    facts,
    caveats,
  };
}
