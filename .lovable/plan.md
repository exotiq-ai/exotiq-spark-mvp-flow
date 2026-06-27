
# Command Center Redesign — "Quiet Command"

## Design thesis
The dashboard today is a wall of widgets competing for attention: hero banner, metrics bar, AI insight, revenue, fleet status, schedule, module nav. An operator opening the app at 8am has to scan ~7 surfaces before knowing what to do. The redesign collapses that to **one decisive surface — the Daily Brief — backed by quiet supporting context**. Inspiration: Linear's inbox, Apple Weather's hero card, Stripe's morning summary email. Not "dashboard", but **"the page that tells you what to do next."**

The `dailyBrief` flag stays the safety net: off = byte-identical to today, on = the new Command Center. We flip it on for the owner account first (per-account override, no deploy).

## What changes (visible)

**1. One hero, not seven.** `DailyBriefCard` becomes the only thing above the fold. Full-width, generous padding, no card chrome competing with it. Structure:
- Greeting line (left): "Good morning, Daniel" + today's date in muted small caps
- Status line (right): 3 inline facts — `8 out · 3 pickups · €4,210 collected` — no boxes, just typography
- **Punch list**: max 5 ranked "needs you" rows, each = severity dot · title · one-tap action. Row click = deep link.
- **Rari's read**: one short paragraph from the edge fn — the *why*, not the *what*. Italic, muted. Deterministic fallback when AI is down.
- Footer: `Today | This Week` segmented toggle (the only chrome).

**2. Hero photo retires from the dashboard** → moves to `/fleet` empty state. Dashboard becomes typographic, calm, Porsche-instruments quiet.

**3. Pulse strip** below the brief: three flat tiles — Revenue (sparkline only), Fleet Status (donut, no legend), Next 4 Hours (3-row list). Click → full module. No collapsibles, no chevrons. Removes the `CollapsibleSection` cognitive tax from the dashboard.

**4. Module nav grid removed from the dashboard.** Sidebar already does this; removing reclaims ~400px and ends the duplication called out in `UI_UX_IMPROVEMENTS.md`.

**5. MotorIQ duplicate weekly digest: removed** (already staged; verify).
**6. BannerWidget: removed from the dashboard** when flag on. Marketing chrome doesn't belong on an operator tool. Kept on demo account.

**7. Role variants**:
- Owner/Admin: punch list weighted to revenue + exceptions
- Manager: weighted to ops (pickups, returns, late returns)
- Operator: weighted to next 4 hours; "This Week" toggle hidden

## Theme + responsive commitments (non-negotiable)

- **Zero hardcoded colors.** Every surface uses semantic tokens from `index.css` (`--background`, `--foreground`, `--muted-foreground`, `--card`, `--border`, `--primary`, severity tokens). Audited in both themes before merge.
- **Dark + light parity.** Each new component visually QA'd in both themes via Playwright screenshots. Severity dots, Rari italic paragraph, segmented toggle, sparkline, donut all verified for contrast (WCAG AA min).
- **Mobile-first layout.** Breakpoints: `< 640` single column, status line wraps under greeting, punch list rows become full-width tap targets (min 44px), Pulse strip stacks vertically. `640–1024` two-column Pulse strip. `≥ 1024` full layout. Safe-area insets respected (`pb-[env(safe-area-inset-bottom)]`).
- **Tap targets** ≥ 44px on mobile; punch list row uses full row as the hit area, not just the action button.
- **Typographic scale** uses existing Tailwind tokens; no inline `text-[14px]` magic numbers.
- **Reduced motion**: any subtle fade/stagger respects `prefers-reduced-motion`.

## What changes (invisible)

- **Per-account flag override**: `?ff=dailyBrief` query param + `localStorage.ff_dailyBrief`. Static `featureFlags.ts` stays the global default `false`. Owner flips it on without a deploy.
- `DailyBriefCard` reads from `useDailyBrief` (already on `main` via PR #19). Numbers deterministic; only the narrative paragraph comes from the edge fn.
- PII guard in `daily-brief-narrative` stays: titles only, no `detail`, regex strip of emails/phones/long digit runs.
- `weekly-intelligence-digest` → `verify_jwt = true` in `config.toml` (legacy unsafe; flagged last turn).
- Delete `src/components/dashboard/DashboardOverview.tsx` (unused; Phase 6).

## Out of scope (deliberately)
Drag-and-drop customization · daily cron + emailed brief + `daily_briefs` table · @mentions workstream B · sidebar/IA changes (FLAG lane).

## Risks
1. **Removing module nav grid** is the most opinionated change. If operators miss it, restore as compact footer row — cheap revert.
2. **Hero photo removal** is brand-adjacent; keeping it on `/fleet` preserves Exotiq feel.
3. **localStorage flag** is fine for owner self-test, not a real entitlement system. If we need per-team rollout later → `team_settings.feature_flags` jsonb.

## Build order (single PR, all behind `dailyBrief`)
1. Flag override plumbing (`?ff=` + localStorage) in `src/lib/featureFlags.ts`.
2. `DailyBriefCard` redesign (hero typography, punch list rows, Rari paragraph, Today/Week toggle). Token-only colors. Dark + light verified.
3. `PulseStrip` component (3 flat tiles, no collapsibles). Responsive stack.
4. `DashboardOverviewEnhanced` rewritten: `<DailyBriefCard /> <PulseStrip />` when flag on; untouched when off.
5. Role-aware ranking via thin selector on `useDailyBrief` + `useUserRole`.
6. Move hero photo to `/fleet` empty state; remove `BannerWidget` from dashboard when flag on.
7. `weekly-intelligence-digest` → `verify_jwt = true`.
8. Delete `DashboardOverview.tsx`.
9. Enable for owner via localStorage; verify numbers match Pulse/Bookings; AI-down fallback; flag-off pixel-identical.

## Verification gates
- Owner / Manager / Operator each see correct variant
- Brief numbers === Pulse === Bookings (deterministic)
- AI key missing → fallback narrative renders
- `dailyBrief=false` → dashboard pixel-identical to today (Playwright screenshot diff)
- **Theme + responsive matrix**: Playwright captures dark+light × mobile/tablet/desktop for `DailyBriefCard` and `PulseStrip` — 6 screenshots reviewed before merge
- `security--run_security_scan` + `supabase--linter` clean
- No new public-schema tables; no GRANT review needed

## Why this is the right plan
The existing `docs/command-center/PLAN.md` is good but still treats the dashboard as "a set of widgets to arrange." The bolder move — what makes this *impressive* rather than *tidier* — is committing to **one surface that makes a decision for the operator**, and trusting the sidebar + click-through for everything else. That's the Apple/Linear/Stripe move. Every other change serves that one idea.
