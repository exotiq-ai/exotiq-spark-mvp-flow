

# Add Legal Policy Pages with Full Content

## Overview
Create four legal pages with the actual document content from your Google Docs, linked from the landing page footer. All pages are public (no auth required).

## Changes

### 1. Create shared layout: `src/components/layout/LegalPageLayout.tsx`
- Navigation header, back-to-home link, prose-styled content container
- Consistent formatting for headings, lists, tables, and legal text
- Responsive padding and max-width

### 2. Create four page components in `src/pages/legal/`
Each renders the full document content as formatted JSX:

- **`Terms.tsx`** — Terms and Conditions (19 sections, ~367 lines of content)
- **`Privacy.tsx`** — Privacy Policy (11 sections, ~167 lines)
- **`AcceptableUse.tsx`** — Acceptable Use Policy (7 sections, ~81 lines)
- **`DataProcessing.tsx`** — Data Processing Agreement (13 sections, ~173 lines)

All content including tables (pricing tiers, third-party providers), bullet lists, and ALL CAPS disclaimer sections will be faithfully rendered.

### 3. Add routes in `src/App.tsx`
Four public routes inside the `ProvidersWrapper` layout:
- `/terms`, `/privacy`, `/acceptable-use`, `/data-processing`

### 4. Update `src/components/landing/Footer.tsx`
Replace the Legal column's placeholder `#` links with actual `<Link>` routes. Replace "Security" with "Acceptable Use" and add "Data Processing":
- Privacy → `/privacy`
- Terms → `/terms`
- Acceptable Use → `/acceptable-use`
- Data Processing → `/data-processing`

## File Summary
- 1 new shared layout component
- 4 new page components (with full legal text)
- 2 existing files updated (App.tsx, Footer.tsx)

