# Command Center — Daily Brief: Lovable Handoff Prompt Pack

Branch: `feat/command-center-daily-brief`
Built locally already (do NOT recreate): `src/hooks/useDailyBrief.ts` (deterministic facts).

Paste these prompts into Lovable **one at a time, in order**. Each is self-contained and guardrailed. After each Lovable run, pull the change back into local before sending the next prompt.

---

## Golden rules (apply to every prompt below)

- This is a **live production app**. Every change must be **additive** and **feature-flagged** — the existing dashboard must keep working unchanged when the flag is off.
- **Do NOT modify** `src/hooks/useDailyBrief.ts` (it was hand-built and verified). Only **consume** it.
- **Do NOT** rename, move, or restructure existing files unless a prompt explicitly says so. No "while I'm here" refactors.
- **Do NOT** touch billing, Stripe, auth, RLS, or any `supabase/functions/*` except where a prompt explicitly says so.
- Keep it icon-light and collapsible. No new sidebar entries. No new dependencies.
- Match the existing design system (shadcn `Card`, `Badge`, `Button`, lucide icons, Tailwind tokens like `text-success`, `text-warning`, `bg-primary/10`). Mirror the visual language of the existing `WeeklyDigestCard.tsx`.

---

## The data contract (already shipped) — code against this exactly

`useDailyBrief()` returns a `DailyBriefFacts` object:

```ts
import { useDailyBrief } from '@/hooks/useDailyBrief';

interface DailyBriefFacts {
  greetingName: string;        // first name, falls back to "there"
  companyName?: string;
  dateLabel: string;           // e.g. "Saturday, June 27"
  role: 'owner' | 'admin' | 'manager' | 'operator' | 'viewer' | null;

  // Operational punch-list counts (today)
  onRent: number;
  pickupsToday: number;
  returnsToday: number;
  overdueReturns: number;
  newBookings24h: number;
  pendingConfirmations: number;
  openTasks: number;
  overdueTasks: number;
  utilization: number;         // %

  // Money
  revenueToday: number;
  revenueMonth: number;
  outstandingBalance: number;

  issues: DailyBriefIssue[];   // pre-ranked high -> low
  metrics: DailyBriefMetric[]; // headline chips
  loading: boolean;
  isClear: boolean;            // true => show the "All clear" state
}

interface DailyBriefIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'booking' | 'payment' | 'task' | 'maintenance' | 'damage' | 'pricing';
  title: string;
  detail?: string;
  module?: string;             // pass to onModuleClick for navigation
  meta?: Record<string, string | number | null | undefined>; // ids for deep-link
}

interface DailyBriefMetric {
  key: string;
  label: string;
  count: number;
  amount?: number;             // present on revenue chips
  module?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}
```

---

## PROMPT A — Build `DailyBriefCard.tsx` (the new hero)

> **Task:** Create a new component `src/components/dashboard/DailyBriefCard.tsx`. Do not modify any other file.
>
> It takes one prop: `onModuleClick: (moduleId: string) => void`.
>
> Use the existing hook `useDailyBrief()` from `@/hooks/useDailyBrief` for ALL data — do not fetch anything yourself and do not recompute any numbers. Match the visual style of `src/components/dashboard/WeeklyDigestCard.tsx` (same `Card`, gradients, badges, lucide icons).
>
> Layout, top to bottom:
> 1. **Greeting header:** "Good morning/afternoon/evening, {greetingName}" (pick the time-of-day word from the local hour) + `{companyName} • {dateLabel}` as a muted subline. Small `Brain`/`Sparkles` icon like WeeklyDigestCard.
> 2. **Punch-list metric row:** render `facts.metrics` as compact clickable chips (count + label; if `amount` present show `$` formatted). Clicking a chip calls `onModuleClick(metric.module)`. Use `tone` for color accents (success=green, warning=amber, danger=red, default=muted).
> 3. **"Needs you" section:** render `facts.issues` (already ranked). Each row: a severity dot/badge (high=destructive, medium=warning, low=muted), `title` bold, `detail` muted below, and a chevron that calls `onModuleClick(issue.module)`. Cap at the top 5 issues with a "View all" affordance if more.
> 4. **Clear state:** when `facts.isClear` is true, replace the issues section with a calm "All clear — nothing needs your attention right now." with a subtle check icon.
> 5. **Loading state:** when `facts.loading`, render a skeleton consistent with existing dashboard skeletons (`@/components/ui/skeleton-card`).
>
> Leave a clearly-commented placeholder slot near the top for an AI narrative line (a single italic muted paragraph) — we will wire it in a later prompt. For now render nothing there.
>
> Keep it fully responsive and touch-friendly. No new dependencies.

---

## PROMPT B — Wire the brief into the dashboard (reorder + shrink hero + role tuning)

> **Task:** Modify ONLY `src/components/dashboard/DashboardOverviewEnhanced.tsx` and `src/lib/featureFlags.ts`. Additive and flag-gated.
>
> 1. In `src/lib/featureFlags.ts`, add a new flag under "Dashboard Features": `dailyBrief: false,`.
> 2. In `DashboardOverviewEnhanced.tsx`, import `isFeatureEnabled` from `@/lib/featureFlags` and the new `DailyBriefCard`.
> 3. When `isFeatureEnabled('dailyBrief')` is true, render `<DailyBriefCard onModuleClick={onModuleClick} />` as the FIRST element of the main content stack (above `CompactMetricsBar`), and **shrink the hero**: render the existing `<BannerWidget />` in a compact, collapsible/hideable form (use a `useLocalStorage` boolean `dashboardHeroVisible` defaulting to false, with a small "Show banner" toggle — mirror the existing `dashboardFleetSchedule` collapse pattern already in this file).
> 4. When the flag is false, render the existing layout EXACTLY as it is today (no behavior change). This is critical.
> 5. Role tuning (use the already-imported `useUserRole`): the `DailyBriefCard` itself shows everything, but in this file, only render the existing `RevenueWidget` revenue-heavy section prominently for `isManagerOrHigher('manager')`; for `viewer`/`operator` keep the brief + tasks focus and de-emphasize revenue. Do not remove anything for any role — only reorder/emphasize.
>
> Do not change `useDailyBrief`, `DailyBriefCard`, or any other file. Keep all existing dialogs and handlers intact.

---

## PROMPT C — Fold the Weekly Digest into the brief (Today | This Week)

> **Task:** Add a "Today | This Week" segmented toggle so the weekly digest lives alongside the daily brief, and remove the duplicate from MotorIQ.
>
> 1. In `DailyBriefCard.tsx` (or a thin wrapper in `DashboardOverviewEnhanced.tsx`), add a small segmented control with two options: **Today** (the daily brief, default) and **This Week**. When "This Week" is selected, render the EXISTING `WeeklyDigestCard` component (`src/components/dashboard/WeeklyDigestCard.tsx`) — reuse it, do not rebuild it.
> 2. In `src/components/dashboard/MotorIQEnhanced.tsx`, remove the now-duplicated `WeeklyDigestCard` instance from the Overview tab (around lines 265–267) so the digest has a single home on the dashboard. Leave the rest of MotorIQ (pricing, AI Recommendation, demand forecast) untouched.
>
> Gate all of this behind `isFeatureEnabled('dailyBrief')` so MotorIQ keeps its digest when the flag is off.

---

## PROMPT D — `daily-brief-narrative` edge function (AI narrative layer)

> NOTE: This may be done in Lovable OR locally. It is thin and must follow the contract precisely.
>
> **Task:** Create `supabase/functions/daily-brief-narrative/index.ts`, modeled on the existing `supabase/functions/weekly-intelligence-digest/index.ts` (same CORS, same Lovable AI gateway call pattern with `google/gemini-3-flash-preview`).
>
> Critical differences:
> - It receives a **facts payload in the request body** (counts + role + a short list of issue titles). It must **NOT** compute or invent any numbers — it only rephrases.
> - **Compliance (DPA §3.8):** the payload must contain only aggregate counts and non-PII issue titles. Do **NOT** send customer names, license numbers, financial account numbers, or any government/biometric identifiers to the gateway.
> - Output JSON: `{ narrative: string (2-4 sentence polite punch list, tone tuned by role), topActions: string[] }`.
> - Graceful fallback: if `LOVABLE_API_KEY` is missing or the call fails, return a deterministic template string built from the counts (same fallback pattern the weekly function uses for `topAction`).
> - Register it in `supabase/config.toml` with `verify_jwt = true`.
>
> Then wire it into `DailyBriefCard.tsx`: call it once per day (cache the result in `localStorage` keyed by `daily-brief-narrative:{YYYY-MM-DD}:{role}`), and render the returned `narrative` in the italic placeholder slot from Prompt A. If the call fails, simply render nothing in that slot (the deterministic facts already stand on their own).

---

## PROMPT E — Platform flow fix: settings deep links

> **Task:** Small, isolated fix. In `src/components/dashboard/settings/SettingsLayout.tsx`, make the tab selection read the `?tab=` query param on mount (and update it when the tab changes) so deep links like `?tab=billing` from `PaymentDueBanner.tsx` open the correct settings tab. Use `useSearchParams`. Do not change anything else.

---

## Rollout / verification (you, after Lovable returns the work)

1. Keep `dailyBrief: false` in production until verified.
2. Flip to `true` for your own account first; confirm the brief's numbers exactly match Pulse and Bookings for the same date/location.
3. Test as Owner, Manager, and Operator — confirm role emphasis and that nothing is missing.
4. Confirm with the flag OFF the dashboard is byte-identical to today.
5. Merge `feat/command-center-daily-brief` → `main` → Lovable sync → Netlify deploy.
