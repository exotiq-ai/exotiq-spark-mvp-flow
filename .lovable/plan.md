

# Wire Company Logo Upload

## Current State
- `BannerCustomizationSection` exists with full logo upload/remove logic but is **not imported or rendered anywhere**
- The onboarding Step 1 ("Business Profile") collects company name, address, phone, website — but no logo
- "My Account" settings has avatar upload but no company logo
- The logo upload saves to `teams.logo_url` and is already consumed by the sidebar/header

## Recommendation

I agree with your instinct — but I'd **simplify the approach** rather than wiring the full `BannerCustomizationSection` (which bundles banner height, text position, carbon fiber, etc. — features that aren't fully wired to the banner component anyway).

Instead, extract **just the logo upload piece** and place it in two spots:

### 1. Onboarding Step 1 — "Business Profile"
Add an optional logo upload below Company Name. Keep it lightweight — avatar-style preview with an upload button. Label: "Company Logo (Optional)". This lets new users brand immediately without friction.

### 2. Settings → My Account
Add a "Company Branding" card below the existing profile card. Same logo upload UI — preview, upload, remove. This is where users go to change it later.

The dead `BannerCustomizationSection` settings (banner height, text position, carbon fiber, company name/tagline overrides) can stay dormant — they're not functional in the banner component anyway and would add clutter.

## Technical Plan

| # | File | Change |
|---|------|--------|
| 1 | **New: `src/components/shared/CompanyLogoUpload.tsx`** | Extract the logo upload logic from `BannerCustomizationSection` into a reusable component. Props: `logoUrl`, `onLogoChange`, `isUploading`. Handles file validation, upload to `dashboard-banners` bucket, update `teams.logo_url`, and `refreshTeam()`. |
| 2 | **`src/pages/Onboarding.tsx`** | In Step 1, add `CompanyLogoUpload` below Company Name input. Optional — doesn't affect step validation. |
| 3 | **`src/components/dashboard/settings/MyAccountSection.tsx`** | Add a "Company Branding" card with `CompanyLogoUpload` below the profile card. Visible to all users (team context provides the current logo). |

Three files touched, clean reuse, no dead settings clutter.

