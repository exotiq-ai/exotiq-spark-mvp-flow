

# Dashboard New User Experience + Onboarding Tour Overhaul

## Scope: 3 distinct improvements

---

### 1. Personalized Welcome + Bulk Upload Button (Quick Win)

**File: `src/components/dashboard/DashboardOverviewEnhanced.tsx`**

The empty state (lines 330-357) currently shows a generic "Welcome to Exotiq!" message. Changes:

- Import `useProfile` hook to get `profile.full_name` (first name) and `profile.company_name`
- Update heading: `"Welcome, {firstName}!"` with subtitle `"Let's get {companyName || 'your fleet'} set up."`
- Add a second button: "Bulk Import from CSV" that opens the ImportWizard dialog
- Import `ImportWizard` and add a `Dialog` wrapper (same pattern used in `FleetPageEnhanced.tsx`)
- Layout: two buttons side-by-side — primary "Add Your First Vehicle" + outline "Import Fleet from CSV"

---

### 2. New User Dashboard Checklist Card

When a new user has 0 vehicles, in addition to the welcome message, show a lightweight "Getting Started" checklist below it with progress tracking:

- Add your first vehicle (or import fleet)
- Create your first booking
- Set up your team (invite members)
- Take the platform tour

Each item links to the relevant action. This gives new users who skipped onboarding a clear path forward without feeling lost. Computed from real data (vehicle count, booking count, team member count, tour_completed).

**File: `src/components/dashboard/DashboardOverviewEnhanced.tsx`** — add checklist section below the empty state CTA buttons.

---

### 3. Rari-Narrated Automated Demo Tour (The Big Feature)

This is the "slick" experience you described — Rari narrates while the app automatically navigates, clicks tabs, and highlights UI elements with cinematic animations.

**Architecture:**

```text
┌─────────────────────────────────────┐
│         AutomatedDemoTour           │
│  ┌───────────┐  ┌────────────────┐  │
│  │ DemoScript│  │  Rari TTS      │  │
│  │ (steps)   │──│  (ElevenLabs)  │  │
│  └───────────┘  └────────────────┘  │
│         │                           │
│  ┌──────▼──────────────────┐        │
│  │  DemoOrchestrator       │        │
│  │  - navigates modules    │        │
│  │  - clicks tabs          │        │
│  │  - zooms into elements  │        │
│  │  - syncs with narration │        │
│  └─────────────────────────┘        │
└─────────────────────────────────────┘
```

**New files:**

| File | Purpose |
|------|---------|
| `src/components/onboarding/AutomatedDemoTour.tsx` | Main orchestrator component |
| `src/hooks/useDemoScript.ts` | Script definition — array of timed steps with module, tab, selector, zoom, narration text |
| `src/hooks/useDemoOrchestrator.ts` | Executes script steps: navigates modules, scrolls to elements, triggers zoom animations, syncs with TTS |

**How it works:**

1. **Script**: ~15-20 steps, each with: `{ module, tab?, selector?, narration, duration, zoomLevel?, highlight? }`. Covers Dashboard → Pulse → Book (calendar, CRM, payments tabs) → MotorIQ → Vault → Fleet → back to Dashboard.

2. **Orchestration**: For each step:
   - Call `onModuleChange(step.module)` to navigate
   - Wait for render (300ms)
   - If `step.tab`, programmatically click the tab selector
   - If `step.selector`, scroll element into view + apply zoom/spotlight animation
   - Play Rari narration via ElevenLabs TTS (existing edge function)
   - Wait for narration to finish (or duration timeout)
   - Transition to next step with cinematic animation

3. **Zoom animations**: Use framer-motion to scale the viewport toward the target element with a smooth spring transition, creating a "camera zoom" effect. The spotlight uses a larger, more dramatic ring with particle effects.

4. **Rari narration**: Uses the existing ElevenLabs TTS integration. Each step has a short narration script (1-2 sentences). Audio plays while the UI animates. Fallback: show subtitles if TTS fails or user mutes.

5. **Controls**: Floating control bar at bottom — Play/Pause, Skip to next, Exit. Progress bar showing completion. Estimated time remaining.

6. **Entry points**:
   - "Take the Full Tour" button on the Getting Started checklist
   - Settings → "Restart Full Tour"
   - Auto-prompt for brand new users who skip the quick tour

**Replace existing `InteractiveModuleTour`?** No — keep the quick 90-second tour as-is for now. The automated demo is a separate, deeper experience. But the quick tour's UI (glass card) should get the same cinematic zoom animations.

### 3b. Upgrade Quick Tour Animations

**File: `src/components/onboarding/TourSpotlight.tsx`**

- Replace the current ring/glow with a cinematic zoom effect: the SVG overlay scales and pans toward the target element
- Add particle sparkle effects around the spotlight
- Smoother path animation on the cutout (spring physics)

**File: `src/components/onboarding/InteractiveModuleTour.tsx`**

- Add zoom transition between steps: scale the overlay from current spotlight to next
- Card entrance: slide in from the edge nearest the spotlight, not just fade

---

## Implementation Priority

1. **Personalized welcome + bulk upload** — small, immediate value
2. **Getting Started checklist** — helps lost users, computed from real data
3. **Quick tour animation upgrade** — improves existing experience
4. **Rari-narrated automated demo** — the flagship feature, depends on TTS + orchestration

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/dashboard/DashboardOverviewEnhanced.tsx` | Modify — personalized welcome, bulk import button, checklist |
| `src/components/onboarding/AutomatedDemoTour.tsx` | Create — orchestrator UI |
| `src/hooks/useDemoScript.ts` | Create — scripted step definitions |
| `src/hooks/useDemoOrchestrator.ts` | Create — step execution engine |
| `src/components/onboarding/TourSpotlight.tsx` | Modify — cinematic zoom animations |
| `src/components/onboarding/InteractiveModuleTour.tsx` | Modify — improved transitions |

