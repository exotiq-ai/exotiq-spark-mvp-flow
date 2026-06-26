## What Orion's real CSV exposes

Running their `vehicles_data.csv` through the current importer fails on three things beyond the country/locale issue:

| Column | Their value | Importer behavior today | Fix |
|---|---|---|---|
| `current_rate` | `£2500/day` | `z.coerce.number()` → `NaN` → row rejected | Strip currency symbols (`£ $ € ¥`), thousands separators, and trailing units (`/day`, `/night`, `/week`, `per day`, `pd`) before coercing. |
| `status` | `active` | Not in enum (`available, rented, maintenance, unavailable, booked`) → rejected | Add synonym map: `active / in service / live → available`; `rented out / on rent → rented`; `out of service / off road → unavailable`. |
| `location` | `London, UK` | Stored as free text on the vehicle (works) but no `locations` row is created | Optional: queue "create location?" suggestion in the import summary. Not blocking. |
| `image` | `/Users/g.r./…/Rolls-Royce_Cullinan_Black.jpeg` | Field doesn't exist in vehicle schema → silently dropped | Detect a column named `image / photo / image_url / hero_image`. If values look like local file paths, surface a post-import banner: "7 vehicles reference photos by filename — drop these files into Photo Hub to auto-match." Filenames like `Rolls-Royce_Cullinan_Black.jpeg` already work with the existing matching logic (`mem://photo-hub/matching-logic`). |
| `year, vin, license_plate, mileage` | blank | Already optional — OK | No change. |

Also: importer currently labels `current_rate` as "Daily rental rate in dollars" — make it currency-agnostic and pull the symbol from the tenant's `currency`.

## Updated plan

### 1. Backfill Orion to UK defaults
Single UPDATE on `teams` (`e925a6fa-…`):
`country_code='GB', currency='GBP', locale='en-GB', tax_label='VAT', tax_rate_percent=20, tax_inclusive=true, tax_id_label='VAT number'`.

### 2. Add Country/Region to Onboarding (`src/pages/Onboarding.tsx`)
- New `country_code` field on Business Profile step, default via `detectCountryFromBrowser()`, dropdown from `SUPPORTED_COUNTRIES`.
- On save, write the derived currency/locale/tax fields to the `teams` row using `getCountryDefaults(code)`. Still editable later in Settings → Business Profile.

### 3. Make the CSV importer Orion-proof (`src/lib/importSchemas.ts`, `src/lib/importUtils.ts`)
- **Currency-tolerant numbers.** Add a `cleanNumeric()` preprocess used by `current_rate`, `mileage`, and any future numeric field: strips `£$€¥`, commas, and trailing rate-units. Falls back to `null`/`0` cleanly.
- **Status synonyms.** Wrap the status enum in a `z.preprocess` that maps common synonyms before validation.
- **Image column awareness.** Add `image` as a recognised (non-stored) field with aliases `photo, image_url, hero_image, photo_path`. Collect non-URL values into the import result so `ImportSummary` can render a "Photos to upload" panel listing filenames and a "Go to Photo Hub" CTA.
- **Currency-agnostic copy.** Replace "in dollars" with "in tenant currency" and show the live `currency` symbol in the rate column header/example.

### 4. Region-aware CSV templates (`src/lib/importTemplates.ts`)
- Per-country sample sets, starting with `US` and `GB`. `GB` vehicles sample mirrors Orion's columns: UK reg (`LB24 XYZ`), `£` rate, `London, UK` location.
- `downloadTemplate(entityType, countryCode?)`; callers in `ImportWizard` pass the tenant's `country_code`.

### 5. Verify
- Re-upload Orion's exact CSV — all 7 rows import green; rates show as `£2,500`; statuses become `available`; post-import banner lists the 7 image filenames.
- Download vehicles template as Orion → UK-flavored examples.
- Re-run as a US tenant → unchanged behavior.

## Out of scope
- Auto-creating `locations` rows from free-text vehicle location strings (suggested-only).
- Image ingestion from local file paths (impossible from browser; existing Photo Hub drag-drop covers it).
- Schema migration — `teams` already has every column needed.

## Technical notes
- Files touched: `src/pages/Onboarding.tsx`, `src/lib/importSchemas.ts`, `src/lib/importUtils.ts`, `src/lib/importTemplates.ts`, `src/components/import/ImportWizard.tsx`, `src/components/import/ImportSummary.tsx`.
- Data update via `supabase--insert` (UPDATE on `teams`).
- No edge-function, storage, or RLS changes.
