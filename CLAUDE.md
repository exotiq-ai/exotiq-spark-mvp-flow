# exotiq Command Center — house rules

The operator app at app.exotiq.ai (Vite + React + Supabase, deployed on Netlify). Read this first in every session.

## Where the truth is
- **Production = `main`.** `app.exotiq.ai` is built from `main` and nothing else. Lovable no longer edits this
  repository; do not sync or merge anything from Lovable branches (`lovable-archive` is history only).
- Every change: a short branch from `main` → pull request into `main` → CI green → owner's go → merge → deploy.
- One session per task. Start by reading `CHANGELOG.md` (recent changes) and `git log --oneline -15`.

## Never without the owner's explicit word in chat
- Merging into `main`, publishing a deploy, deploying an edge function.
- Any write to the production database (migrations included). Reads are fine.
- Anything in Stripe, DNS, auth settings, or a tenant's data.
An earlier "yes" covers only what it named.

## How to change things
- **UI / logic:** write or update a vitest test in `src/test/` first, then the change. Before calling it done:
  `npm run typecheck` and `npx vitest run` must pass. Lint has an old `no-explicit-any` backlog: do not add
  new `any`, do not mass-fix old ones in unrelated work.
- **Database:** a new file in `supabase/migrations/` (never edit an applied one), idempotent, with a read-only
  test in `supabase/tests/`. It is applied to production only on the owner's go, and the PR says so.
- **Edge functions:** `supabase/functions/<name>`; shared code in `_shared/`. A pure helper gets a vitest test.
- **Errors shown to users:** use `describeError()` from `src/lib/describeError.ts`; never `String(e)`
  (Supabase errors are plain objects and print `[object Object]`).
- **Money:** marketplace bookings are paid in two charges; payment rows of type `fee` / `extension_fees` are
  Exotiq's revenue, never the operator's (`src/lib/paymentLegs.ts`).

## Writing
- The brand is "exotiq" or "Exotiq", never "ExotIQ".
- This repository is public: no secrets, keys, tenant names, personal data or internal incident detail in code,
  commits or pull requests. Never print a secret, even partly.
- After a change ships, add one line to `CHANGELOG.md`: date, what changed, why.
