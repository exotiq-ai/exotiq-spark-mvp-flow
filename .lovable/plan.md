

# Add Company Logo Upload and Display

## Current State

The database already has `logo_url` columns on both the `teams` table and `user_dashboard_preferences` table, but **there is no UI to upload a company logo anywhere**. The `BannerCustomizationSection` in Settings handles company name/tagline but has no logo upload. The header always shows the hardcoded Exotiq logo.

## Plan

### 1. Add Logo Upload to Banner Customization Settings
**`src/components/dashboard/settings/BannerCustomizationSection.tsx`**
- Add a "Company Logo" upload section (image picker + preview + remove button)
- Upload to existing `dashboard-banners` storage bucket
- Save the URL to `teams.logo_url` (team-level, so all members see it)
- Show a circular preview of the current logo with a fallback icon
- Accept PNG, SVG, JPG — recommend square/transparent background

### 2. Display Company Logo in the Header
**`src/components/dashboard/DashboardHeader.tsx`**
- Read `currentTeam.logo_url` from `useTeam()` context (already available)
- If `logo_url` exists, show the company logo **next to** the Exotiq logo (Exotiq stays as you specified)
- Layout: `[Exotiq Logo] | [Company Logo]` with a subtle divider

### 3. Display in Sidebar
**`src/components/dashboard/DashboardSidebarEnhanced.tsx`**
- When expanded, show company logo below the Exotiq logo if available
- When collapsed, show just the company logo icon (small)

### Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/settings/BannerCustomizationSection.tsx` | Add logo upload UI with preview, upload to storage, save to `teams.logo_url` |
| `src/components/dashboard/DashboardHeader.tsx` | Show company logo from `currentTeam.logo_url` next to Exotiq logo |
| `src/components/dashboard/DashboardSidebarEnhanced.tsx` | Show company logo in sidebar when available |

No database migrations needed — `teams.logo_url` column already exists.

