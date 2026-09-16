# Fleet onboarding fixes: default location, optional year, missing rates on edit

Three separate problems, all confirmed against the live ARK account (9 imported cars: rates set, 8 of 9 with no location, 8 of 9 with no year).

## 1. New vehicles get the default location automatically

Today a car is created with no location unless someone picks one, so bulk-imported fleets all come in blank and have to be edited one by one.

Fix it once at the database level so every path benefits — CSV import, the add-vehicle form, and anything we add later:

- When a vehicle is created without a location, fill it with that workspace's default location. If the workspace has no default marked, use its only location; if it has several and no default, leave it blank.
- The add-vehicle form pre-selects the default location so it is visible before saving.
- One-off cleanup: fill in the blank locations on existing cars for workspaces that have a single location or a marked default. Workspaces with several locations and no default are left untouched.

## 2. Year becomes optional

Year is not part of the marketplace readiness rules (checked: readiness requires a photo, a rate, a location, and available status), but both the add and edit forms refuse to save without it.

- Drop the required mark and validation on Year in both forms.
- Where a car's name is built from year + make + model, skip the year cleanly when it is missing so nothing shows "undefined" on the fleet card, the booking screens or the public listing.

## 3. Rates missing when you open a car's details then Edit

Root cause found. The fleet card and MotorIQ read the car's real record, so they show the right rate. But when you open a car's detail card and press "Edit Vehicle Details", the detail card hands the edit form a trimmed-down summary object — the rate lives there under a different name, and license plate, VIN, location, mileage allowance and the public-listing settings are absent entirely. The edit form therefore opens with an empty rate and blank fields, which is why it feels like re-entry.

- Hand the edit form the car's full record instead of the summary, so it opens with everything already filled in.
- Same fix for the "create a task" hand-off from that detail card, which shares the same trimmed object.
- After the fix, opening a freshly imported car and pressing Edit shows the imported rate, plate, VIN, location and mileage terms without typing.

## Technical notes

- New trigger on `vehicles` (BEFORE INSERT) resolving `location_id` from `locations` where `is_default`, falling back to the single-location case; plus a one-time `UPDATE` backfill run separately from the schema change.
- `AddVehicleDialog.tsx`: preselect default location, remove `required`/`validators.required(year)`/`validators.year`; `year: parseInt(year)` becomes null when blank.
- `EditVehicleDialog.tsx`: Year input no longer `required`; blank year saves as null.
- `VehicleImageDialog.tsx` lines ~375 and ~486 pass `{ id, name, ...vehicleDetails }`; instead the parent (`FleetPageEnhanced.tsx`, and any other mount of this dialog) supplies the full vehicle row to `onEdit`/`onCreateTask`.
- Label builders using `${year} ${make} ${model}` get null-safe joins.
- Verify afterwards with a read against ARK: locations backfilled, marketplace readiness unchanged, and a Playwright pass opening a car's details then Edit to confirm the rate is populated.
