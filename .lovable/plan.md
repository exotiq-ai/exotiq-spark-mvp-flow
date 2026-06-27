## Plan: Post-merge review of PR #19

### Step 1 — You merge PR #19 on GitHub
Lovable's bidirectional sync will pull the merged commit into this workspace automatically (usually within seconds). Ping me once it's in.

### Step 2 — Identify the merge
I'll run `git log` to find the merge commit for PR #19 and list every file it touched (`git show --stat <sha>`).

### Step 3 — Read every changed file
For each touched file I'll open the post-merge version and, where useful, diff it against the pre-merge parent (`git show <sha> -- <path>`).

### Step 4 — Review checklist
For each change I'll flag:
- **Correctness** — logic bugs, unhandled error/empty states, race conditions, broken imports
- **Type safety** — `any`, missing return types, unsafe casts
- **Security** — RLS/grants on any new tables, secret leakage, input validation in edge functions, XSS in rendered AI output
- **Tenant isolation** — every query scoped by `team_id` (per project Core memory)
- **Design system** — no hardcoded colors, semantic tokens only, no "coming soon" placeholders (Core memory)
- **Feature flags** — incomplete surfaces gated via `src/lib/featureFlags.ts`
- **Performance** — N+1 queries, missing memoization in hot paths
- **Tests** — note any new logic that should have a unit test (e.g. `safeFormat`)

### Step 5 — Backend verification
If the PR touches DB or edge functions:
- `security--run_security_scan` for fresh findings
- `supabase--linter` for schema issues
- Confirm GRANTs exist on any new public-schema tables

### Step 6 — Report
A single grouped report:
- ✅ Looks good
- ⚠️ Nits / suggestions
- 🛑 Must-fix before publish

### Step 7 — Fix + publish (only on your go-ahead)
If you say "fix and ship," I'll apply the must-fixes, re-run the security scan, then call `preview_ui--publish` after confirming title/meta/OG/favicon are still relevant.

### Notes
- I can't un-merge. If review surfaces a 🛑 issue, the fix will be a follow-up commit, not a revert (unless you ask).
- If sync hasn't landed after a couple of minutes, paste the merge commit SHA and I'll verify.
