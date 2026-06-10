# Lovable Prompts — UI/UX (Lane 2)

Visual/design changes the audit identified that are best authored by Lovable (not hand-coded), because Lovable owns the UI generation loop and would likely regenerate over a hand-authored visual change.

**How to use:** paste these into Lovable one at a time, top to bottom (they're ordered so nothing depends on a later prompt). Each is self-contained, names the exact file, states acceptance criteria, and tells Lovable to leave unrelated files alone. Don't batch them — one prompt, one change, verify, next.

Source: `audit/uiux.md` (LP-01 … LP-11). Lane 1 (mechanical/testable) fixes are handled in code on the `audit/uiux` PR; Lane 3 (structural) items are in `FLAGGED.md`.

---

## 1. Auth — give "Forgot password?" its own view (highest impact)

> On the Auth page (`src/pages/Auth.tsx`), the "Forgot password?" flow currently renders as an inline animated panel that slides in below the tab content, inside the same Card as the sign-in form — so two forms are visible at once. Refactor it so clicking "Forgot password?" replaces the entire tab area with a dedicated reset-password view, the same way `update-password` mode renders its own separate Card layout. Use `authMode === 'reset'` (already in state) as the condition, and include a "Back to sign in" button. Keep card height consistent.
>
> Acceptance criteria: (1) sign-in form and reset form are never both visible in the same Card at once; (2) a "Back to sign in" button returns to the sign-in tab; (3) no change to any other auth mode and no file outside `src/pages/Auth.tsx`.

## 2. Auth — fix demo helper text & email capitalisation

> On the Auth page (`src/pages/Auth.tsx`), the "Contact for Demo" button uses `mailto:Hello@exotiq.com` (capital H) while the rest of the app uses lowercase `hello@exotiq.com` — make it consistent. Also, the helper text "Demo mode includes pre-populated fleet data for testing" (near line 878) is misleading because the demo route currently redirects to `/auth`. Replace it with accurate text such as "Contact hello@exotiq.com to request a demo," or remove it.
>
> Acceptance criteria: (1) email capitalisation consistent; (2) helper text doesn't reference an inaccessible demo mode; (3) no other auth logic changed; (4) only `src/pages/Auth.tsx` touched.

## 3. Onboarding — skeleton loading state instead of a bare spinner

> On the Onboarding page (`src/pages/Onboarding.tsx`), the loading state (around line 448) is just a centered `<Loader2>` spinner. Replace it with a skeleton that mirrors the onboarding Card: progress dots at the top in skeleton style, a placeholder heading, and 3–4 input skeleton rows, using `<Skeleton>` from `@/components/ui/skeleton`.
>
> Acceptance criteria: (1) no isolated spinner; (2) skeleton matches the card max-width and padding of the real form; (3) only the loading render path changes; (4) no other files touched.

## 4. Onboarding — accessible progress bar

> On the Onboarding page (`src/pages/Onboarding.tsx`), the step progress indicator (around line 467) is a row of colored bar segments with no ARIA context. Add `role="progressbar"` to the outer container with `aria-valuenow={step}`, `aria-valuemin={1}`, `aria-valuemax={totalSteps}`, and `aria-label="Onboarding progress"`. Keep the existing "Step X of Y" text.
>
> Acceptance criteria: (1) `role="progressbar"` on the bar container; (2) `aria-valuenow` updates per step; (3) no visual change; (4) no other files touched.

## 5. 404 page — give marketing visitors a way home

> On the 404 page (`src/pages/NotFound.tsx`), the only CTA is "Go to Dashboard" (→ `/dashboard`), which bounces unauthenticated users to `/auth` and is mislabeled for them. Show two CTAs: "Back to Home" (Link to `/`, styled as the primary button) and "Go to Dashboard" (Link to `/dashboard`, styled as secondary/outline).
>
> Acceptance criteria: (1) two buttons on the 404 page; (2) "Back to Home" is primary; (3) no other pages or routes changed.

## 6. Landing nav — make the logo a home link

> On the landing navigation (`src/components/landing/Navigation.tsx`), the Exotiq logo (around line 45) is a plain `<div>`. Wrap `<Logo size="md" />` in `<Link to="/" aria-label="Exotiq home" className="flex items-center">` from `react-router-dom`.
>
> Acceptance criteria: (1) logo is a focusable link to `/`; (2) `aria-label="Exotiq home"` present; (3) visually identical; (4) only this file changed.

## 7. Dashboard header — label the team-chat icon

> On the dashboard header (`src/components/dashboard/DashboardHeader.tsx`), the team-messaging icon button (`<MessageSquare>`, around line 80) has no tooltip or label. Wrap it in a `<Tooltip>` (from `@/components/ui/tooltip`, `<TooltipTrigger asChild>` pattern already used elsewhere) with content "Team Messages", and add `aria-label="Team messages"` to the button.
>
> Acceptance criteria: (1) tooltip on hover; (2) `aria-label` present; (3) no layout/functional change; (4) only `DashboardHeader.tsx` changed.

## 8. Sidebar — label the collapse toggle

> In the dashboard sidebar (`src/components/dashboard/DashboardSidebarEnhanced.tsx`), the collapse/expand toggle (around line 379) has no text or `aria-label` when collapsed. Add `aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}` and a matching `title` attribute for a hover tooltip.
>
> Acceptance criteria: (1) `aria-label` describes the action in both states; (2) tooltip on hover when collapsed; (3) no visual/functional change; (4) only this file changed.

## 9. Mobile More menu — clearer active-module highlight

> In `src/components/mobile/MobileMoreMenu.tsx`, when a module in the "More" sheet is active, the active item's icon doesn't reliably contrast on its `bg-primary` icon box. For the icon box (the `w-11 h-11 rounded-xl` div around line 148), when `activeModule === item.id` make the inner icon `text-primary-foreground` and the item label `text-primary`.
>
> Acceptance criteria: (1) active module's icon is visually distinct from inactive ones; (2) active label is `text-primary`; (3) no other files changed.

## 10. Welcome — skeleton for the Calendly embed

> On the Welcome page (`src/pages/Welcome.tsx`), the Calendly widget shows a bare `<Loader2>` spinner in a 500px bordered box while the external script loads (around lines 298–301). Replace it with a skeleton card: a calendar-icon placeholder, a "Schedule Your Session" heading skeleton, and three skeleton rows, using `<Skeleton>` from `@/components/ui/skeleton`. Don't change the script-loading logic or the Calendly URL.
>
> Acceptance criteria: (1) no bare spinner; (2) three skeleton rows in the 500px container while loading; (3) Calendly still renders after load; (4) only `src/pages/Welcome.tsx` changed.

## 11. Welcome — add a branded header with a way out

> The `/welcome` page (`src/pages/Welcome.tsx`) has no top navigation; the only exit is a "Skip for now" button at the bottom. Add a sticky top header mirroring the LegalPageLayout pattern: the Exotiq logo (linked to `/`) on the left and a ThemeToggle on the right.
>
> Acceptance criteria: (1) header with Logo and ThemeToggle at top; (2) logo links to `/`; (3) the Skip button is unchanged; (4) only `src/pages/Welcome.tsx` changed.

---

### Note on schema changes
No hosted-schema changes are required by this audit. Suspected schema drift between the repo migrations and the hosted (Lovable-managed) instance is documented in `FLAGGED.md` / `audit/plan-stress-tests.md` for you to reconcile in Lovable — the audit never connected to the hosted instance.
