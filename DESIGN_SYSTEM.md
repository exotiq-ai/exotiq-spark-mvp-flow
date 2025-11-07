# ExotIQ Design System - Phase 2 Implementation

## Color Rationalization Strategy

### Core Principle: Semantic Color Usage
We've consolidated from 5+ competing colors to a clear semantic hierarchy:

### Primary Colors

**Primary (Deep Slate Blue)**
- **USE FOR:** Main navigation, primary CTAs, key module actions, primary buttons
- **HSL:** `221 83% 53%`
- **Examples:** Module icons (MotorIQ, Pulse, Core), primary action buttons, main navigation highlights

**Secondary (Refined Gray)**
- **USE FOR:** Secondary actions, supporting UI elements, less prominent features
- **HSL:** `220 9% 46%`
- **Examples:** Secondary buttons, module icons (Book, Vault), alternative actions

### Semantic State Colors

**Success (Green)**
- **USE ONLY FOR:** Success states, confirmations, positive metrics, completed actions
- **HSL:** `142 71% 45%`
- **Examples:** Revenue up indicators, completed bookings, available vehicles

**Warning (Orange)**
- **USE ONLY FOR:** Warnings, pending states, caution notices, attention needed
- **HSL:** `38 92% 50%`
- **Examples:** Maintenance due, expiring documents, pending approvals

**Destructive (Red)**
- **USE ONLY FOR:** Errors, deletions, critical warnings, failed states
- **HSL:** `0 84% 60%`
- **Examples:** Error messages, delete buttons, critical alerts

### Accent (Purple)**
- **USE ONLY FOR:** AI features, FleetCopilot, premium highlights, special promotions
- **HSL:** `262 83% 58%`
- **Examples:** AI recommendation cards, Rari voice interface, premium badges

## Typography Hierarchy

### Scale
- **Hero:** `text-6xl` (60px) - Main dashboard metrics, hero numbers
- **H1:** `text-4xl` (36px) - Page titles, major headings
- **H2:** `text-2xl` (24px) - Section headers, card group titles
- **H3:** `text-xl` (20px) - Card titles, subsection headers
- **Body:** `text-base` (16px) - Default text (no class needed)
- **Small:** `text-sm` (14px) - Secondary information, labels
- **Tiny:** `text-xs` (12px) - Minimal text, micro-labels

### Usage Examples
```tsx
// Hero metric
<h2 className="text-hero">${revenue.month.toLocaleString()}</h2>

// Page title
<h1 className="text-h1">Dashboard</h1>

// Section header
<h2 className="text-h2">Revenue Trend</h2>

// Card title
<h3 className="text-h3">Active Bookings</h3>

// Small text
<p className="text-small text-muted-foreground">Last updated 5 min ago</p>
```

## Module Color Consolidation

### Before (5 Different Colors)
- MotorIQ: Teal
- Pulse: Blue
- Book: Purple
- Vault: Orange
- Core: Green

### After (2 Colors)
- **Primary Modules:** MotorIQ, Pulse, Core → `text-primary` / `border-primary`
- **Secondary Modules:** Book, Vault → `text-secondary` / `border-secondary`

This reduces visual noise and creates clear grouping:
- **Primary = Core Operations** (analytics, monitoring, CRM)
- **Secondary = Management** (bookings, documents)

## Button Standardization

Use shadcn button variants consistently:

```tsx
// Primary action
<Button variant="default">Save Changes</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Tertiary action
<Button variant="ghost">Learn More</Button>

// Destructive action
<Button variant="destructive">Delete</Button>
```

## Card Patterns

Use consistent border and shadow weights:

```tsx
// Standard card
<Card className="p-6 border-2 border-border shadow-sm hover:shadow-md">

// Emphasized card (modules, important features)
<Card className="p-8 border-2 border-border shadow-md hover:shadow-lg">

// Interactive card (clickable)
<Card className="p-6 border-2 border-border hover:border-primary/50 shadow-sm hover:shadow-md cursor-pointer">
```

## Dos and Don'ts

### ✅ DO
- Use `primary` for all main actions and core modules
- Use semantic colors (success/warning/destructive) only for their intended states
- Use `accent` sparingly for AI/premium features
- Apply typography hierarchy consistently
- Use `border-2` for emphasized elements

### ❌ DON'T
- Don't use `success` for general positive actions (use `primary`)
- Don't use `warning` for general CTAs (use `secondary`)
- Don't create custom color classes (use design tokens)
- Don't use `text-white` or `bg-white` directly (use `foreground`/`background`)
- Don't mix border weights randomly

## Migration Checklist

When updating components:
- [ ] Replace hardcoded colors with semantic tokens
- [ ] Apply typography hierarchy classes
- [ ] Use shadcn button variants (not custom classes)
- [ ] Update module colors to primary/secondary
- [ ] Ensure border-2 on emphasized cards
- [ ] Test in both light and dark mode
