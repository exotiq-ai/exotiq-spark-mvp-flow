# Exotiq UI/UX Audit — Static Code Review
**Date:** 2026-06-10  
**Auditor:** Claude Code (read-only static analysis)  
**Scope:** src/pages, src/components (non-shadcn), index.html, public/, src/lib/moduleRoutes.ts

---

## FIX-DIRECT Findings

### FD-01 — Broken internal link: `/features` route does not exist
- **File:** `src/components/landing/Footer.tsx:24`, `src/components/landing/FeaturesSection.tsx:72`
- **What's wrong:** Both `<Link to="/features">` point to a route that is not registered in `src/App.tsx`. The router has no `<Route path="/features">` entry, so clicking "Features" or "Explore All Features" on the landing page hits the 404 catch-all.
- **Desired outcome:** Either register a `/features` page route or change both links to `#features` (the on-page anchor id used by the scroll-to logic in the landing Navigation component).
- **Acceptance criteria:** Clicking either "Features" link stays on the landing page at the features section, or navigates to a valid `/features` route without hitting NotFound.

---

### FD-02 — Broken navigation from Onboarding edit-mode: `?tab=settings` is an unknown tab
- **File:** `src/pages/Onboarding.tsx:309`, `src/pages/Onboarding.tsx:383`
- **What's wrong:** After saving in edit mode the code calls `navigate('/dashboard?tab=settings')`. The Dashboard shell only processes `?module=` query params (not `?tab=`). The correct path to the settings module is `/dashboard/settings`. The settings page itself has no tab named "settings" — valid tab IDs are `account`, `team`, `locations`, `notifications`, `subscription`, `integrations`, `data`, `payments`.
- **Desired outcome:** Replace both navigate calls with `navigate('/dashboard/settings')`.
- **Acceptance criteria:** After saving in Onboarding edit mode the user lands on the Settings module with the default "My Account" tab active, not on the raw `/dashboard` overview.

---

### FD-03 — Broken image: PWA icon `public/exotiq-logo.png` is not a valid PNG
- **File:** `public/exotiq-logo.png`, `vite.config.ts:28`
- **What's wrong:** The file `public/exotiq-logo.png` contains only the text `copy` (a stub/placeholder). The vite-plugin-pwa manifest references it as the 512×512 app icon. Any PWA install will display a broken/blank icon. `favicon.ico` is also referenced by the vite plugin's `includeAssets` array but the file does not exist in `public/`.
- **Desired outcome:** Replace `public/exotiq-logo.png` with a valid 512×512 PNG of the Exotiq emblem (the SVG source exists at `public/brand/logos/svg/d-emblem-gulf-blue-transparent.svg`). Add a `favicon.ico` to `public/`, or remove it from `includeAssets` if the SVG favicon in `index.html` is sufficient.
- **Acceptance criteria:** `public/exotiq-logo.png` passes `file` as a valid PNG; browser DevTools PWA panel shows icon without error; no console 404 for `favicon.ico`.

---

### FD-04 — Missing `aria-label` on notifications bell trigger button (accessibility)
- **File:** `src/components/common/UnifiedNotificationCenter.tsx:556`
- **What's wrong:** The `<Button variant="ghost" size="icon">` that renders the `<Bell>` icon has no `aria-label`. Icon-only buttons must have an accessible name for screen readers.
- **Desired outcome:** Add `aria-label="Notifications"` (or `aria-label={unreadCount > 0 ? \`Notifications, ${unreadCount} unread\` : "Notifications"}`) to the trigger button.
- **Acceptance criteria:** axe or VoiceOver identifies the button as "Notifications"; automated a11y scan reports no missing-label violation on this element.

---

### FD-05 — Missing `aria-label` on header chat/messaging icon button
- **File:** `src/components/dashboard/DashboardHeader.tsx:80-92`
- **What's wrong:** The `<Button variant="ghost" size="icon">` containing the `<MessageSquare>` icon has no `aria-label`. The mobile nav equivalent (Dashboard.tsx:454-465) also lacks one.
- **Desired outcome:** Add `aria-label="Team messages"` (with optional unread count suffix) to both icon-only message buttons.
- **Acceptance criteria:** Both message buttons have an accessible name in the DOM; screen reader announces "Team messages" on focus.

---

### FD-06 — `tabIndex={1}` on skip-navigation link breaks tab order
- **File:** `src/components/common/SkipNavigation.tsx:8`
- **What's wrong:** `tabIndex={1}` forces this element to be the second item in global tab order (index 1), which can conflict with any other element that has `tabIndex={1}` and disrupts the natural document flow. The skip-nav link should use `tabIndex={0}` (or no tabIndex) and rely on being the first element in DOM order, which it already is given its position in the rendered tree.
- **Desired outcome:** Change `tabIndex={1}` to `tabIndex={0}`.
- **Acceptance criteria:** Pressing Tab on any page with the skip link as the first focusable DOM element activates it first; no other element fights for focus position 1.

---

### FD-07 — Keyboard shortcuts help panel lists `⌘N` (New Booking) and `⌘Shift+V/C` but none are implemented
- **File:** `src/components/common/KeyboardShortcutsHelp.tsx:36-40`, `src/hooks/useKeyboardShortcuts.ts`
- **What's wrong:** The help dialog documents `⌘N → New booking`, `⌘Shift+V → Add vehicle`, and `⌘Shift+C → Add customer`. None of these key handlers exist in `useKeyboardShortcuts.ts`. Users who discover the shortcut panel and attempt these shortcuts get no response. Also `?` is listed as "Open help center" but there is no help center route or handler.
- **Desired outcome:** Either implement the handlers in `useKeyboardShortcuts.ts` or remove the undocumented shortcuts from the `KeyboardShortcutsHelp` list so the panel only shows working shortcuts.
- **Acceptance criteria:** Every shortcut listed in the help dialog produces the documented action, or the panel only lists implemented shortcuts.

---

### FD-08 — Social icon links in Footer are dead `href="#"` placeholders
- **File:** `src/components/landing/Footer.tsx:77-92` (3 social icon anchors)
- **What's wrong:** The Twitter/X, GitHub, and LinkedIn footer icons all link to `href="#"`. This causes page scroll-to-top on click instead of navigating to actual profiles. Three "Company" links (About, Blog, Careers) are also `href="#"`.
- **Desired outcome:** Replace `href="#"` with real destination URLs or `href="https://twitter.com/exotiq_ai"` (etc.) for social links, and `href="#"` company links should either navigate to real pages or be replaced with `<span>` to indicate "coming soon" without false affordance.
- **Acceptance criteria:** No `href="#"` remains on elements with visual link styling; clicking social icons opens the correct external destination in a new tab.

---

### FD-09 — `index.html` meta description is too generic; `twitter:site` credits `@lovable_dev` not Exotiq
- **File:** `index.html:13`, `index.html:24`
- **What's wrong:** `<meta name="description" content="Exotiq Command Center">` is a 2-word developer placeholder, not a real description for SEO/social sharing. The `<meta name="twitter:site" content="@lovable_dev">` credits Lovable's own Twitter handle rather than Exotiq's.
- **Desired outcome:** Update `description` to match the marketing copy already in use (e.g. "AI-powered fleet management platform for luxury and exotic car rental operators"). Update `twitter:site` to Exotiq's own Twitter/X handle once established, or remove the tag.
- **Acceptance criteria:** `<meta name="description">` in index.html is 50–160 characters and describes the product. `twitter:site` either reflects an Exotiq-owned handle or the tag is removed.

---

### FD-10 — OG image defaults to `og-image.jpg` which does not exist in `public/`
- **File:** `src/components/common/SEOHead.tsx:21`
- **What's wrong:** The `SEOHead` component defaults `image` to `'/og-image.jpg'`. That file does not exist in `public/`. All pages that use `SEOHead` without a custom image prop (including the landing page and legal pages) will emit a 404 for the OG image, producing no preview thumbnail when shared on social networks.
- **Desired outcome:** Add an `og-image.jpg` (1200×630) to `public/`, or update the default in `SEOHead` to reference an existing asset such as the external social image URL already used in `index.html`.
- **Acceptance criteria:** `https://exotiq.ai/og-image.jpg` resolves to a valid image; social share preview renders a non-broken thumbnail.

---

### FD-11 — `confirm-password` field missing on Signup tab; only present in password-update flow
- **File:** `src/pages/Auth.tsx:739-808` (signup TabsContent)
- **What's wrong:** The "Sign Up" tab (`TabsContent value="signup"`) collects email, full name, and password — but no confirm-password field. A user can set a mistyped password with no verification. The password-update form correctly requires confirmation (lines 411-425). The signup flow in the invitation path also lacks a confirm field.
- **Desired outcome:** Add a "Confirm Password" field to the standard signup form and the invitation signup form. Validate they match before calling `signUp`. `PasswordStrengthMeter` is already present; add the confirm field below it.
- **Acceptance criteria:** Submitting the signup form with mismatched passwords shows an inline validation error; `signUp` is not called until passwords match.

---

## LOVABLE-PROMPT Findings

### LP-01 — Auth page: reset-password panel appears inline below the tabs, overlapping the card visually
- **File:** `src/pages/Auth.tsx:813-873`
- **Prompt for Lovable:**
  > On the Auth page (`src/pages/Auth.tsx`), the "Forgot password?" flow currently renders as an inline animated panel that slides in below the tab content, sitting inside the same Card. This creates a confusing layout where two forms coexist in the card at once (the sign-in form above, the reset panel below).
  >
  > Please refactor the reset password UI so that clicking "Forgot password?" replaces the entire tab area with a dedicated reset-password view — the same way the `update-password` mode renders a completely separate Card layout. Use `authMode === 'reset'` as the condition (already in state), and render a standalone section with a back button to return to sign-in. The card height should remain consistent.
  >
  > Desired outcome: Clicking "Forgot password?" replaces the tab switcher and sign-in form with a clean reset-password panel; no two forms are visible simultaneously.
  > Acceptance criteria: (1) Sign-in form and reset form are never both visible in the same Card at the same time; (2) A "Back to sign in" button returns to the sign-in tab; (3) No change to any other auth mode or file outside `src/pages/Auth.tsx`.

---

### LP-02 — Onboarding loading state is a bare spinner with no context
- **File:** `src/pages/Onboarding.tsx:448-454`
- **Prompt for Lovable:**
  > On the Onboarding page (`src/pages/Onboarding.tsx`), when the page is loading (edit mode or progress sync), the user sees only a bare `<Loader2>` spinner centered on the screen with no text. This is disorienting for new users who just signed up and are waiting for their first screen to appear.
  >
  > Please replace the loading state (the `return` around line 448) with a skeleton that mirrors the Card structure of the onboarding form: show the progress bar dots at the top in skeleton style, a placeholder heading, and 3–4 input skeleton rows. Use `<Skeleton>` components already available in `@/components/ui/skeleton`.
  >
  > Desired outcome: The loading state looks like a ghosted version of the onboarding card, reducing perceived wait time.
  > Acceptance criteria: (1) No isolated spinner; (2) The skeleton matches the card max-width and padding of the real form; (3) No functional changes — only the loading render path is altered; (4) Leave all other files untouched.

---

### LP-03 — Dashboard 404 page sends unauthenticated users to `/dashboard` (dead end)
- **File:** `src/pages/NotFound.tsx:23`
- **Prompt for Lovable:**
  > On the 404 Not Found page (`src/pages/NotFound.tsx`), the "Go to Dashboard" button links to `/dashboard`. If an unauthenticated user reaches a bad URL, clicking the button just redirects them to `/auth` via `ProtectedRoute`. This is fine functionally but the button label "Go to Dashboard" is misleading for someone who is not logged in.
  >
  > Please update the 404 page to show two contextual CTAs: "Go to Dashboard" (Link to `/dashboard`) and "Back to Home" (Link to `/`). Position "Back to Home" as the primary action (default button style) and "Go to Dashboard" as a secondary/outline button. Both links are already valid routes.
  >
  > Desired outcome: The 404 page gives a clear path home for marketing visitors and a dashboard path for authenticated users.
  > Acceptance criteria: (1) Two buttons visible on the 404 page; (2) "Back to Home" styled as primary; (3) No other pages or routes changed.

---

### LP-04 — Dashboard mobile nav has no visual indicator for the active module on the "More" sheet items
- **File:** `src/components/mobile/MobileMoreMenu.tsx:140-161`
- **Prompt for Lovable:**
  > On mobile, when a module like "Fleet" or "MotorIQ" (which live in the "More" sheet) is active, the bottom nav bar highlights the "More" button as active — but inside the sheet, the active item does use a border highlight. However the icon within the active item's icon-box does not change color to match the brand primary, making it harder to confirm "where am I" at a glance.
  >
  > Please update the active-state icon box inside `MobileMoreMenu` (the `w-11 h-11 rounded-xl` div around each module icon, around line 148) so that when `activeModule === item.id`, the icon inside uses `text-primary-foreground` color (it currently inherits but may not contrast on the `bg-primary` background reliably). Also make the item label text `text-primary` (not just `font-medium`) when active.
  >
  > Desired outcome: Tapping Fleet, MotorIQ, Vault etc. and re-opening the sheet shows the active module with a clearly highlighted icon and label that matches the brand color system.
  > Acceptance criteria: (1) Active module's icon is visually distinct from inactive icons in the sheet; (2) Active label text is `text-primary`; (3) No other files changed.

---

### LP-05 — Onboarding step 1: progress bar segments have no accessible labels
- **File:** `src/pages/Onboarding.tsx:467-474`
- **Prompt for Lovable:**
  > On the Onboarding page, the step progress indicator (`src/pages/Onboarding.tsx` around line 467) renders as a row of colored bar segments but provides no text or ARIA context about total steps or current position. The `<p>` below ("Step 1 of 4") is present but is not associated with the progress bar element.
  >
  > Please add `role="progressbar"` to the outer flex container, along with `aria-valuenow={step}`, `aria-valuemin={1}`, `aria-valuemax={totalSteps}`, and `aria-label="Onboarding progress"`. The existing `<p>Step {step} of {totalSteps}</p>` text can remain as visual feedback below.
  >
  > Desired outcome: Screen readers announce the onboarding step progress correctly. Visually unchanged.
  > Acceptance criteria: (1) `role="progressbar"` present on the bar container; (2) `aria-valuenow` updates as the user progresses; (3) No visual changes; (4) No other files changed.

---

### LP-06 — Landing page: Navigation bar logo has no accessible link to home
- **File:** `src/components/landing/Navigation.tsx:44-46`
- **Prompt for Lovable:**
  > On the Landing page navigation (`src/components/landing/Navigation.tsx`), the Exotiq logo in the header is rendered inside a plain `<div>` and is not a link. Standard practice for marketing pages is to make the logo a home link so keyboard/screen reader users can quickly return to the top of the page.
  >
  > Please wrap the `<Logo size="md" />` (around line 45) in a `<Link to="/" aria-label="Exotiq home">` from `react-router-dom`. Apply `className="flex items-center"` to the Link to preserve layout.
  >
  > Desired outcome: Clicking the logo in the nav returns to `/`; keyboard users can navigate to home via the logo. Visually identical.
  > Acceptance criteria: (1) Logo is a focusable, clickable link to `/`; (2) `aria-label="Exotiq home"` present; (3) No other nav items or files changed.

---

### LP-07 — Auth page: "Contact for Demo" email link not associated with any visible label context
- **File:** `src/pages/Auth.tsx:505-513`
- **Prompt for Lovable:**
  > On the Auth page, the "Contact for Demo" button opens a `mailto:` link (`mailto:Hello@exotiq.com?subject=Exotiq Demo Request`). The email address used is `Hello@exotiq.com` — note the capital H, while the rest of the codebase and marketing uses lowercase `hello@exotiq.com`. Please verify the correct capitalisation and correct it if needed.
  >
  > Additionally, the "Demo mode includes pre-populated fleet data for testing" helper text at the bottom of the page (line 878) is potentially confusing since the demo route is currently disabled (both `/demo-landing` and `/demo` redirect to `/auth`). Please update this text to accurately reflect the current state, e.g. "Contact hello@exotiq.com to request a demo" or remove it entirely.
  >
  > Desired outcome: The demo helper text accurately reflects available actions for a new visitor; no misleading affordance.
  > Acceptance criteria: (1) Email capitalisation is consistent; (2) Helper text does not reference a demo mode that is not accessible; (3) No other auth flow logic changed.

---

### LP-08 — Dashboard header: team-chat icon button has no visible tooltip or label on desktop
- **File:** `src/components/dashboard/DashboardHeader.tsx:80-92`
- **Prompt for Lovable:**
  > On the Dashboard header (`src/components/dashboard/DashboardHeader.tsx`), the team messaging icon button (`<MessageSquare>`) shows an unread badge but has no tooltip. Other icon buttons in the same row (ThemeToggle, notification bell) are convention-expected; this one is left unlabeled.
  >
  > Please wrap the message button in a `<Tooltip>` (using the existing `@/components/ui/tooltip`) with content "Team Messages". The `<TooltipTrigger asChild>` pattern is already used elsewhere in the codebase. Add `aria-label="Team messages"` to the button itself as a fallback.
  >
  > Desired outcome: Hovering the chat icon shows "Team Messages" tooltip on desktop; button is accessible to screen readers.
  > Acceptance criteria: (1) Tooltip appears on hover; (2) `aria-label` is present; (3) No layout or functional changes; (4) Only `DashboardHeader.tsx` is changed.

---

### LP-09 — Welcome page: Calendly embed uses `isCalendlyLoaded` script-inject pattern — loading state shows a bare spinner
- **File:** `src/pages/Welcome.tsx:292-303`
- **Prompt for Lovable:**
  > On the Welcome page (`src/pages/Welcome.tsx`), the Calendly booking widget shows a bare `<Loader2>` spinner while the external script loads (lines 298-301). The spinner is centered inside a `500px` tall white box with a border, which looks unfinished.
  >
  > Please replace the loading placeholder with a skeleton card that includes: a calendar icon placeholder, a heading skeleton ("Schedule Your Session"), and three skeleton rows to suggest time slots. Use `<Skeleton>` from `@/components/ui/skeleton`. The script-loading logic and Calendly URL should not change.
  >
  > Desired outcome: The Calendly loading state looks intentional and on-brand, not like a broken widget.
  > Acceptance criteria: (1) No bare spinner; (2) Three skeleton rows inside the 500px container while loading; (3) Calendly widget still renders correctly after load; (4) Only `src/pages/Welcome.tsx` changed.

---

### LP-10 — Sidebar collapse toggle button has no accessible label when collapsed
- **File:** `src/components/dashboard/DashboardSidebarEnhanced.tsx:378-396`
- **Prompt for Lovable:**
  > In the dashboard sidebar (`src/components/dashboard/DashboardSidebarEnhanced.tsx`), the collapse/expand toggle button at the bottom (around line 379) shows either `<ChevronLeft>` + "Collapse" text or just `<ChevronRight>` when collapsed. When collapsed, the button has no text and no `aria-label`, making it invisible to screen readers and ambiguous to new users.
  >
  > Please add `aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}` to the collapse toggle `<Button>`. Also add a `title` attribute with the same value so a tooltip appears on hover in the collapsed state.
  >
  > Desired outcome: The collapse button is accessible and self-describing in both states.
  > Acceptance criteria: (1) `aria-label` correctly describes the action in both states; (2) Tooltip visible on hover in collapsed state; (3) No visual or functional changes; (4) Only this file changed.

---

### LP-11 — Empty state for legal pages navigation: `/welcome` is reachable without auth but has no nav link from any public page
- **File:** `src/pages/Welcome.tsx`, `src/App.tsx:96`
- **Prompt for Lovable:**
  > The `/welcome` page (post-payment founding member onboarding) is reachable by URL but is not linked from the landing page footer, the auth page, or anywhere visible to organic users. It also lacks a "Back" or "Home" navigation link — the only exit is the "Skip for now, take me to the dashboard" ghost button at the bottom, which uses `navigate('/dashboard')`.
  >
  > Please add a sticky top navigation bar to `src/pages/Welcome.tsx` that mirrors the LegalPageLayout header pattern: Exotiq logo (linked to `/`) on the left and a ThemeToggle on the right. This gives users a way out and a consistent framing without depending on browser Back.
  >
  > Desired outcome: Users who land on `/welcome` see a branded header with a home link; the page feels intentional.
  > Acceptance criteria: (1) Header with Logo and ThemeToggle present at top; (2) Logo links to `/`; (3) Skip button at bottom unchanged; (4) Only `src/pages/Welcome.tsx` changed.

---

## FLAG Findings

### FLAG-01 — Dual toast systems (use-toast + sonner) running simultaneously
- **File:** `src/App.tsx:2-3`, `src/hooks/useKeyboardShortcuts.ts:13`, `src/pages/Dashboard.tsx:64`
- **What's wrong:** `<Toaster>` (shadcn radix toasts via `use-toast`) and `<Sonner>` (sonner library) are both mounted in the root (`App.tsx`). Approximately 79 files use `useToast()` from `@/hooks/use-toast`, while ~30+ files import `toast` from `sonner`. This means two separate toast queues can appear simultaneously with potentially conflicting visual styles, positions, and dismiss behaviors. This is a structural decision — choosing one system is an IA/infrastructure call, not a visual tweak.
- **Recommended action:** Product owner should decide on a single toast library (Sonner is the more modern choice). A migration pass across all 79 `use-toast` consumers would then be needed. This is a multi-file refactor best handled as a dedicated Lovable session.

---

### FLAG-02 — Mobile "Help & Support" and "Profile" menu items in MobileMoreMenu have no handlers
- **File:** `src/components/mobile/MobileMoreMenu.tsx:72-74`, `handleItemClick` function
- **What's wrong:** The `secondaryItems` array includes `{ id: "help" }` and `{ id: "profile" }`. The `handleItemClick` function has no special case for either ID, so it calls `navigate(moduleIdToPath('help'))` and `navigate(moduleIdToPath('profile'))`. Neither `help` nor `profile` are registered module IDs in `moduleRoutes.ts` or route paths in `App.tsx`. Tapping either item on mobile navigates to `/dashboard/help` or `/dashboard/profile` — which renders the default DashboardOverview (no matching module) rather than an error, but the user's intent is unfulfilled.
- **Recommended action:** Decide whether these are real features to implement (Help Center page, Profile settings page) or whether they should be removed. The Profile intent may be covered by the Account tab in Settings; Help may warrant an external link to a knowledge base.

---

### FLAG-03 — PWA manifest has only one icon size (512×512) and icon file is a stub
- **File:** `vite.config.ts:26-33`, `public/exotiq-logo.png`
- **What's wrong (expanded from FD-03):** Beyond the invalid file content, the manifest lacks the required `192×192` icon size for Android PWA prompt eligibility. Chrome requires both 192 and 512 sizes. Additionally `purpose: 'any maskable'` combines two purposes into one entry — per spec they should be separate entries.
- **Recommended action:** Add proper multi-size PNG icons to `public/` and update the manifest `icons` array. A brand decision on the icon design (emblem only vs. wordmark) is needed before this can be executed.

---

## Summary Counts

| Lane | Count |
|------|-------|
| FIX-DIRECT | 11 |
| LOVABLE-PROMPT | 11 |
| FLAG | 3 |
| **Total** | **25** |

---

## Priority Order for FIX-DIRECT Items

1. **FD-01** (broken /features links — user-facing on landing page)
2. **FD-03** (PWA icon is a stub — affects installability)
3. **FD-02** (broken edit-mode navigation from Onboarding)
4. **FD-11** (no confirm-password on signup — UX/security gap)
5. **FD-07** (phantom keyboard shortcuts — broken trust in help panel)
6. **FD-09** (thin meta description, wrong twitter:site)
7. **FD-10** (missing OG image breaks social sharing)
8. **FD-04** (missing aria-label on notifications bell)
9. **FD-05** (missing aria-label on chat button)
10. **FD-06** (tabIndex={1} on skip-nav)
11. **FD-08** (dead href="#" links in Footer)
