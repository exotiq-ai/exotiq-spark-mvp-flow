# Importing customers from HQ Rental Software

Operators switching from HQ Rental can upload HQ's customer export (Customers → export, `.xlsx` or `.csv`)
in any customer import (CRM → Import, Settings → Data, onboarding). The wizard recognises the file by its
columns, or the operator picks **HQ Rental Software — customers** under "Where is this file from?". The
rows are then converted to exotiq customers before the mapping step, so every column maps one to one.

Code: `src/lib/hqRentalCustomers.ts` (pure, tested in `src/test/hqRentalCustomers.test.ts`), wired in
`src/components/import/ImportWizard.tsx`, summary card in `src/components/import/HqImportBanner.tsx`.

## Recognising the file

An HQ customer export has `Label` and `Email Address` plus at least two of HQ's other customer columns
(below). Header case and spacing do not matter. If the operator chooses the HQ preset and the file does not
match, the upload step says which column is missing.

## Column mapping

| HQ column | exotiq `customers` column | Transformation |
|---|---|---|
| Label | `full_name` | Whitespace collapsed. A name typed all-lowercase or ALL-CAPITALS is capitalised ("jane doe" → "Jane Doe"); a name with any mixed case is kept exactly as typed. |
| Email Address | `email` | Spaces removed, lowercased. Required: `customers.email` is `NOT NULL`. |
| Phone Number | `phone` | Hidden direction marks removed, then the Add Customer form's `normalizePhone`: digits only, `+` kept for international numbers. |
| Street, Street 2, City, State, Zip, Country | `address` | One line: `Street, Street 2, City, State Zip, Country`, blanks left out. |
| Driver License Number | `drivers_license` | Upper-cased. |
| Expiration Date | `license_expiry` | `YYYY-MM-DD`. `.xlsx` files carry Excel day serials; dates and `M/D/YYYY` or `YYYY-MM-DD` text are read too. |
| Reservation Count | `notes` | "HQ Rental: N past reservations." exotiq's `total_bookings` is recalculated from exotiq bookings by a trigger, so HQ's count cannot live there. |
| File Upload | — | Not imported: the export carries only a count ("2 images"), not the files. |
| — | `customer_status` | `active` (HQ's export has no status or blacklist column). |
| — | `tags` | `["HQ import"]`, so imported customers can be filtered. |

## Rules decided by the owner (2026-11-25)

- **No email → left out.** Such rows are listed by name (and phone) on the upload and preview steps so the
  operator can add them by hand. No schema change.
- **One customer per email.** HQ lets several people share one email (someone booking for friends);
  exotiq customers are unique per email (`UNIQUE(user_id, email)`). The row with the most reservations is
  kept (the first on a tie); every other person on that email is written into its notes:
  "Also on this email in HQ Rental: Name (phone …; licence …; N past reservations)."
- **Fields with no column** go to notes and the "HQ import" tag, as above.
- **Name case** is fixed only for all-lowercase / all-capitals names.

Existing customers in the team are matched by email and phone in the wizard's usual Review step (skip,
overwrite or merge), as for any customer import.

## Also changed for every customer import

- Email is now required in the preview, because the database requires it: a phone-only row used to pass the
  preview and then fail its whole insert batch of 50.
- A `tags` column (comma-separated) can be mapped.
