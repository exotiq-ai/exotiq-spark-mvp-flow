

# Improve "Log in" Button Styling

## Problem
The current "Log in" button uses `variant="ghost"` with `text-muted-foreground`, which makes it too subtle — especially in dark mode where it can almost disappear against the background. It also lacks visual weight to clearly signal it as an interactive entry point.

## Proposed Change

Replace the ghost button with a clean **outline-style** button that pairs well with the premium CTA:

```tsx
<Link to="/auth">
  <Button variant="outline" className="border-border hover:border-primary/50">
    Log in
  </Button>
</Link>
```

**Why this works:**
- The `outline` variant provides a visible border in both light and dark themes, giving the button proper presence
- It creates a clear visual hierarchy: **Log in** (outline/secondary) → **Start Free Trial** (premium/filled) — the industry-standard pattern used by Linear, Vercel, Stripe
- The hover state subtly shifts the border toward the brand color
- No custom CSS needed — leverages the existing design system's `outline` variant which already handles dark mode correctly

## Scope
- **One file**: `src/components/landing/Navigation.tsx` — update line 59 (desktop) only. The mobile menu already uses `variant="outline"` and looks correct.

