

# Replace Hardcoded "E" Fallback with Exotiq "D" Brand Icon

## Problem
Line 255-257 of `DashboardSidebarEnhanced.tsx` renders a hardcoded blue square with the letter "E" as the collapsed sidebar fallback when no company logo is uploaded. This should be the Exotiq "D" brand emblem instead.

## Recommendation
Use the **transparent background** SVG (`Blue_D_Transparent_background.svg`). It works on both light and dark themes without clashing, unlike the black-background variant. Copy it to `public/brand/exotiq-d-icon.svg` and replace the hardcoded "E" div with an `<img>` tag.

## Changes

| File | Change |
|------|--------|
| `public/brand/exotiq-d-icon.svg` | Copy the transparent-background D icon from uploads |
| `src/components/dashboard/DashboardSidebarEnhanced.tsx` | Replace the hardcoded "E" `<div>` fallback (lines 254-257) with `<img src="/brand/exotiq-d-icon.svg" alt="Exotiq" className="w-10 h-10 object-contain" />` |

This is a minimal 2-file change. When a user uploads their own company logo, that still takes priority (the `currentTeam?.logo_url` check remains). The "D" icon is only the fallback.

