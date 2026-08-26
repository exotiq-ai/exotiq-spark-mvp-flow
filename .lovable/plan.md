# Pick which tenants the Rari self-test runs against

Yes — the harness already accepts an explicit tenant list; the Super Admin panel just never exposed it. Today it only sends a "sample size" and the backend picks the first N tenants alphabetically, which is why you saw ADMIN and G's Cars instead of the accounts you care about.

## What changes

**Tenant picker in the Rari Self-Test panel**
- Replace the "Live tenants sampled: 1 / 3 / 5" control with a searchable multi-select list of real workspaces (name + owner email + currency), loaded from the database.
- Checkboxes, with a "Select all" / "Clear" pair and a live count.
- Default selection on first open: **Exotiq (hello@exotiq.ai)** and **Exotics By The Bay** — the two accounts you named — plus the dedicated **Rari Self-Test** workspace, which is always included and locked (it's the only tenant with deterministic seeded fixtures, so timeframe, limit, and mutation assertions have nowhere else to run).
- Selection is remembered locally so the next run starts from the same set.
- Keep the sample-size shortcut available as a "quick pick" that fills the checkboxes, so a fast broad run is still one click.

**Backend**
- The run action already honours an explicit `teams` array, so the panel simply sends it. Small hardening: if the caller passes teams, always union in the self-test team rather than silently dropping the seeded-only suites, and return each tenant's owner email in the response so the matrix columns are unambiguous (there are three workspaces named "My Fleet").

**Matrix readability**
- Column headers show the workspace name with the owner email underneath, and a "test" / "live" tag so it's obvious which column carries the strict assertions.

## Notes on the two accounts you named

- `hello@exotiq.ai` owns two workspaces: **Exotiq** and **Rari Self-Test**. The picker will list both by name so you can tell them apart; "Exotiq" is the data-rich one.
- **Exotics By The Bay** exists as a live workspace and will be selectable. Note there is a second, empty workspace named "My Fleet" owned by `exoticsbythebay@exotiq.ai` — the owner-email line in the picker makes that distinction visible so it isn't picked by mistake.

## Technical detail

- `RariSelfTestPanel.tsx`: new tenant-selection state, a `teams` fetch (id, name, currency, owner email), persisted selection in localStorage, and `teams: selectedIds` added to the `rari-selftest` invoke body.
- `supabase/functions/rari-selftest/index.ts`: union the self-test team id into any caller-supplied `teams`, and include `ownerEmail` on each entry of the returned `tenants` array.
- No changes to case lists, assertions, seeding, or auth. Seeding stays hard-locked to the dedicated self-test workspace.
