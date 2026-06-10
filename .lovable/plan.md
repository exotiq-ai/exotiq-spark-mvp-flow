# Plan: LOVABLE-PROMPTS.md — Lane 2 UI/UX pass

11 tightly-scoped, presentation-only fixes. Single sequenced pass, one file per change, existing primitives only (`Skeleton`, `Tooltip`, `Link`, `Logo`, `ThemeToggle`). No new deps, no business logic, no schema/edge work.

## Decisions locked

1. Forgot-password view reuses the **same Card chrome** — swap contents only.
2. Misleading demo helper text is **removed** entirely (no replacement copy).
3. Welcome header logo links to **`/dashboard`**.

## Sequence

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/Auth.tsx` | `authMode === 'reset'` swaps Card contents to reset form + "Back to sign in". Sign-in and reset never co-visible. |
| 2 | `src/pages/Auth.tsx` | Lowercase `hello@exotiq.com`; remove misleading demo helper text entirely. |
| 3 | `src/pages/Onboarding.tsx` | Replace `<Loader2>` loading state with `<Skeleton>` mirroring the card (progress dots, heading, 3–4 rows). |
| 4 | `src/pages/Onboarding.tsx` | Add `role="progressbar"` + `aria-valuenow/min/max` + `aria-label` to step indicator. |
| 5 | `src/pages/NotFound.tsx` | Primary "Back to Home" (`/`) + secondary "Go to Dashboard". |
| 6 | `src/components/landing/Navigation.tsx` | Wrap `<Logo>` in `<Link to="/" aria-label="Exotiq home">`. |
| 7 | `src/components/dashboard/DashboardHeader.tsx` | Wrap team-messaging button in `<Tooltip>` "Team Messages" (aria-label already present). |
| 8 | `src/components/dashboard/DashboardSidebarEnhanced.tsx` | Dynamic `aria-label`/`title` on collapse toggle. |
| 9 | `src/components/mobile/MobileMoreMenu.tsx` | Active item: icon `text-primary-foreground`, label `text-primary`. |
| 10 | `src/pages/Welcome.tsx` | Replace Calendly spinner with skeleton card; script logic untouched. |
| 11 | `src/pages/Welcome.tsx` | Add sticky header with `<Logo>` linked to `/dashboard` + `<ThemeToggle>`, mirroring `LegalPageLayout`. |

Items 3+4 and 10+11 batched per shared file.

## Verification

- Visual check per route (auth, onboarding, 404, landing, dashboard, mobile More, welcome).
- `bunx vitest run` at the end; CI typecheck + build on resulting branch.

## Out of scope

Lane 3 / FLAGGED.md, edge functions, RLS, Stripe, lint `any`-backlog.
