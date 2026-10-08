# Exotiq agent booking — start here

This is the shared continuation package for Claude and the Exotiq technical/operations team. It accompanies the integrated API, renter MCP and customer frontend on paired review branches. It is a locally tested build awaiting hosted acceptance, not a deployed booking service.

## Source branches

| Repository | Checkout branch | Contains |
|---|---|---|
| [Backend](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/tree/codex/agent-booking-backend) | `codex/agent-booking-backend` | API, Supabase migrations/Edge handlers, operator integration, `packages/renter-mcp`, contracts and this continuation package. |
| [Storefront](https://github.com/exotiq-ai/exotiq-rent/tree/codex/agent-booking-frontend) | `codex/agent-booking-frontend` | Next customer sign-in/consent/account/handoff, generated validators and local browser tests. |

A Git worktree is a local checkout; these branches and their draft PRs are the GitHub handoff. Review both repositories together. Exact tested implementation commits are recorded in [source-map.json](source-map.json); later documentation commits do not imply new implementation acceptance.

**Backend integration warning:** GitHub `main` has 172 commits absent from this build branch as checked October 8. It includes newer checkout/compliance/protection and Drizzle migration work. This packet preserves the tested build; it does not reconcile that concurrent work. Before merging or deploying, inspect and integrate current `main`, resolve business-rule/migration/writer differences, refresh source provenance and rerun affected checks. Frontend `main` was an ancestor of its build branch at publication preparation. These observations can change; fetch before acting.

## First reading

1. [Claude kickoff](kickoff.md) and [full handoff](handoff.md).
2. [Fresh test snapshot](reports/TEST-SNAPSHOT-2026-10-08.json) and [results/limits](reports/DISCOVERY-TEST-RESULTS-2026-10-08.md).
3. [Operations assessment](reports/OPERATIONS-PILOT-ASSESSMENT-2026-10-08.md) and [integration review](reports/INTEGRATION-HANDOFF-REVIEW.md).
4. [Planning index](planning/README.md), including both phases and the independently checked Phase 2 plans.
5. [Canonical API guide](../external-booking/guide.md), [OpenAPI](../external-booking/openapi.yaml), [MCP compatibility](../external-booking/mcp-compatibility.md) and [inventory writer audit](../external-booking/inventory-writers.md).

## Latest user direction overrides older recommendations

`exotiq-migration-staging` is reserved for the Lovable-to-owned-Supabase migration. Do not use it as disposable agent staging. The proposed first rehearsal is discovery plus a real authorized request/inventory hold for the Exotiq Scottsdale demo fleet at `https://book.exotiq.rent/exotiq`, observable by the human operator, before payment/Stripe Identity completion. The user asked to discuss the target and scope before changing the existing broader plan.

Current code does not give initial submission a 48-hour payment hold: an identity-pending request normally starts with 24 hours; up to 48 hours starts after eligible operator approval and is capped before pickup. Demo eligibility currently conflicts with a shared predicate excluding demo teams; Scottsdale and public demo data mode have not been proved. Resolve these deliberately. Do not silently bypass identity, consent, admission, eligibility or real tenant rules.

Fresh scoped suites: 321 API unit + 36 contract + 50 MCP + 673 frontend + 12 local Next/Chromium passes, with 25 skips. Browser provider/API boundaries are synthetic. Older SQL evidence is partial-schema and ends at pending requests. No hosted full confirmation or actual named-agent trial has run. Phase 2 planning passed review; execution has not started; full accepted phases/plans remain zero.

## Portable paths and evidence

The repositories are public. The exported documents replace local paths and selected environment identifiers with placeholders. Credentials, provider/customer exports, CLI link state, runtime manifests and database volumes are not part of this packet. [export-manifest.json](export-manifest.json) lists the portable copies and their hashes. These hashes identify the exported copies, not the unredacted local originals.

- `<BACKEND_CHECKOUT>`: your checkout of the backend branch above.
- `<FRONTEND_CHECKOUT>`: your checkout of the paired storefront branch.
- `<HANDOFF_ROOT>`: this `docs/agent-booking` directory. Older `<HANDOFF_ROOT>/.planning/...` references map to `planning/...`; root report names map to `reports/...`; `testing/2026-10-08/...` maps to `evidence/2026-10-08/...`.
- Other `<LOCAL_...>` and project-ref placeholders require local environment mapping. They are not executable shell values or deployment targets.

Archived phase frontmatter/commands need path adaptation before execution. The latest handoff controls over older staging/full-provider recommendations. Resolve the original resource/owner/budget checkpoint before hosted actions. Do not count SUMMARY files or refused guarded tests as acceptance.

The local code fixtures remain in `request-lab/` and `handoff-lab/`. Retained local database volumes have not been exported. Do not run lab reset/start scripts against an existing or hosted database. Read the owned-lab safeguards in the handoff first.

## Claude's immediate assignment

Map actual domain/API/MCP/operator/Supabase bindings read-only; determine whether the demo is persisted and API eligible; propose the smallest safe request rehearsal and explicit scope amendment; prepare isolated code/harness/runbook work; then execute only on the selected reviewed target. Return genuine request/occupancy/operator evidence and cleanup, and write every learned issue into the next-phase backlog. Keep cold discovery, supplied-URL browsing, authenticated task execution and payment confirmation separate.

No merge, cloud schema application, live admission or production deployment is implied by publication of these branches.
