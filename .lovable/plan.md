

# QA Push Plan — SOW-04 Self-Verification

## Overview
Systematic walkthrough of all 8 SOW-04 test sections using browser tools, database queries, and fix-as-you-go approach. Before starting, I'll create test accounts for each role level so Section 4 (RBAC) can be fully verified in the UI.

## Pre-QA Setup: Create Role-Specific Test Accounts

Create 4 test accounts via database (using your existing team and invite flow):

| Account | Email | Role | Purpose |
|---------|-------|------|---------|
| QA Manager | qa-manager@exotiq.ai | manager | Section 4 |
| QA Operator | qa-operator@exotiq.ai | operator | Section 4 |
| QA Viewer | qa-viewer@exotiq.ai | viewer | Section 4 |
| (Your account) | — | owner/admin | Sections 1-3, 5-8 |

Accounts will be created via Supabase Auth admin API + role assignment in `user_roles` and `team_members`, linked to your existing team. Auto-confirm enabled temporarily so no email verification needed for test accounts.

## QA Execution Order

### Pass 1 — Database-Level (Sections 7, 8)
Run SQL queries to verify:
- RLS on `demand_intelligence_cache` and `rari_insights`
- No orphaned `team_members` rows
- CLV trigger fires correctly on booking status changes

These are fast, deterministic checks I can run immediately.

### Pass 2 — Core UI Flow (Sections 1, 3, 5, 6)
Browser-based testing of:
- **Section 1**: Damage claim chain of custody (check-in → inspection → damage report → Vault)
- **Section 3**: Dashboard lazy loading, skeleton states, back/forward navigation
- **Section 5**: Search bar endpoints (Add Customer, Add Vehicle, Fleet)
- **Section 6**: Direct URL routing for all 10+ dashboard modules + legacy redirects

### Pass 3 — Calendar Filters (Section 2)
- Status filter chips, count badges, conflict ring, view toggle persistence

### Pass 4 — RBAC Gating (Section 4)
Log into each test account and verify:
- Admin: all Rari commands visible
- Operator: revenue/pricing/forecast commands hidden
- Viewer: read-only badge, limited sidebar

## Improvements Over the SOW

1. **Console error checks** — After every navigation I'll check for JS errors, not just visual correctness
2. **Network request validation** — Verify no redundant `check-subscription` calls (ties into your cloud optimization)
3. **Mobile viewport spot-check** — Quick resize test on Sections 3 and 6 to catch responsive regressions
4. **Performance baseline** — Collect heap/DOM metrics on dashboard load as a benchmark

## Output

Each section gets a report block:
```text
## Section X: <Name>
Status: PASS / FAIL→FIXED / BLOCKED
Notes: <findings>
Fix applied: <description if any>
```

Final deliverable: `SOW-04-QA-RESULTS.md` saved to `/mnt/documents/` as a downloadable artifact.

## Estimated Runtime
- Setup (test accounts): ~5 min
- Database checks (7, 8): ~5 min  
- UI testing (1, 2, 3, 5, 6): ~15-20 min
- RBAC testing (4): ~10 min
- Fixes + retests: variable
- **Total: ~35-45 min**

## Risk Notes
- **Section 1 (Damage Claims)** depends on having a booking in "checked out" status. If none exists in demo data, I'll need to create one first.
- **Section 4** quality depends on the test accounts being properly scoped. If the invite/role system has edge cases, I'll flag them as BLOCKED.

