## ISSUES FOUND

**Phase:** 02 — Agent discovery and isolated demo-fleet pilot
**Plans checked:** 18; 40 tasks; 10 waves
**Issues:** 1 blocker, 7 warnings

This is static plan verification, not execution acceptance. All ten phase requirement IDs have substantive tasks. All 18 plans pass the actual GSD structure validator; every task has read-first paths, acceptance criteria and automated verification. The dependency graph is acyclic, waves match dependencies, and same-wave declared source ownership does not overlap. No Phase01 or Phase02 full acceptance is established.

### Blocker

RESEARCH.md has six unmarked Open Questions. The mandatory research-resolution gate requires each architectural question to be resolved before planning passes. External resource/product selections must remain genuinely pending, but their **planning disposition** can be resolved to an explicit gated checkpoint. Resolve the host mapping and staging cohort representation from the actual chosen plans; link exact account/budget/owner/product prerequisites to plan10 without inventing a human answer; link the dated report and supported card/operations policy. Mark every question RESOLVED with that rationale and the section `## Open Questions (RESOLVED)`.

### Executable refinements

1. Plan03 task1 directs a stopped preserved lab to restart through existing `lab.mjs start`. Actual B/request-lab/lab.mjs refuses an existing resources.json, and its container entrypoint always runs initdb. No resume command exists. The alternative fresh-lab path should be the explicit executable choice: plan an ownership-guarded new disposable reconciliation lab/bootstrap inside the owned runner, exact image/network/volume bindings, reviewed partial baseline/new migration apply and real two-connection tests. Preserve all earlier manifests/volumes/bookings; never reset/reinitialize them. A new ownership-checked resume implementation would also work if separately assigned/tested.
2. New Edge entrypoints are outside current `tsconfig.external-api.json` include roots. Its command in plan04 does not typecheck external-payment-reconciler or external-payment-operations. Assign the typecheck configuration/runner change explicitly and verify the real new handlers, scheduler and shared adapters. Keep source remote-import/runtime conventions supported rather than silently excluding files.
3. VALIDATION.md/JSON report `0 existing / 0 Wave0/dependency` for the new PaymentCases.test.tsx and discovery Playwright config tasks. These files do have owning tasks, but the map does not record them. Include .test.tsx, browser .spec.ts and --config paths, exact owner task/dependency and current existence. Keep pending/unexecuted status and nyquist flags false until genuine execution.
4. Four plans exceed the 10-file warning threshold:07(13),09(12),14(11),17(12). No plan exceeds the 15-file blocker or five-task blocker. Split across existing task boundaries to reduce context risk while preserving every requirement, file owner and dependency. Do not replace complete work with stubs or silently deferred requirements.

### Checks that passed

- STAGE/PAYREC/PILOT: selected org/budget/issuer/account/DNS/owner gates; exact sandbox platform/connected-account topology; no production fallback. Candidate migration staging is never assumed disposable.
- New SQL ordering: plan12 task2 explicitly blocks managed acceptance until reviewed complete baseline plus03/05/07 migrations are applied to independently attested staging. Effective pg_proc/defaults/ACL/default grants/RLS/constraints/triggers/writers/GUC/PostgREST/gateway/jobs proof is separately required.
- Payment safety: all possible current/legacy attempts and both legs; account/mode/original bindings; provider HTTP outside locks; fenced lease and settlement/inventory races; immutable history; paid/unknown holds retained; no timer, missing webhook, DELETE or operator boolean clearance.
- Customer authority: source next_action and identity-first behavior, original-client consent/revocation/recovery, operator-only approval and immutable itemized amounts. Admission pause preserves owned completion and recovery.
- Discovery: authoritative public eligibility, separate host/dataset/index policy, bounded sitemap pagination/factual lastmod, truthful SSR/LeaseOut JSON-LD, hostile-data escaping and private auth/noindex/no-store/no-referrer. Conventional MCP/text probes and proposed files are not universal standards.
- Evidence: local SQL/source/Next browser, complete hosted provider confirmation and actual named-agent trials remain distinct. Cold discovery cannot be seeded by brand/URL/MCP. Human checkpoints require actual selected client and provider/backend proof; validators alone are insufficient.
- Maintenance/release: actual evaluator CLI, evidence/provenance rejection, fresh dependency and fixture-clock regressions, append-only observed/proposed feedback and human monitored launch review. No automatic live launch.

### Dimension 8 — Nyquist planned coverage

VALIDATION.md exists. All40 tasks have automated commands; all implementation tasks have meaningful affected tests or a planned RED-first owned test creation. Sampling has no three-task gap. Real browser/SQL/provider gates are explicitly longer-running integration acceptance, with quick unit feedback preceding them. New tests are pending, not fictitiously executed. The validation-map path omission above needs correction. nyquist_compliant:false/wave_0_complete:false truthfully remain execution flags.

### Dimension 10 — AGENTS.md

SKIPPED (no AGENTS.md at <LOCAL_HOME> or either isolated source root; no repository .Codex/skills or .agents/skills directories). Home skill catalogs are global, not project coding instructions. Explicit gsd-plan-phase workflow is applied.

### Structured issues

```yaml
issues:
  - plan: null
    dimension: research_resolution
    severity: blocker
    description: "Six Open Questions lack RESOLVED planning dispositions."
    fix_hint: "Resolve architectural choices; bind genuinely pending selections to explicit plan10 gates; mark section and each question RESOLVED without fabricating approvals."
  - plan: "02-03"
    task: 1
    dimension: task_completeness
    severity: warning
    description: "Existing lab start cannot restart a preserved stopped lab and boot reinitializes data."
    fix_hint: "Choose and assign a new ownership-guarded reconciliation lab bootstrap with reviewed partial apply and preserved earlier resources, or separately plan/test a safe resume implementation."
  - plan: "02-04"
    task: 2
    dimension: verification_derivation
    severity: warning
    description: "Current external-api TypeScript configuration excludes new reconciler/operations entrypoints."
    fix_hint: "Assign configuration/runner ownership and explicit commands checking all changed Edge handlers and shared adapters."
  - plan: null
    dimension: nyquist_compliance
    severity: warning
    description: "Validation map omits .test.tsx and Playwright config/spec ownership for planned checks."
    fix_hint: "Map those exact paths, existence and owner task/dependency; retain pending execution status."
  - plan: "02-07"
    dimension: scope_sanity
    severity: warning
    description: "13 modified files exceed the 10-file warning threshold."
    fix_hint: "Split source projection from page/crawler/hosting wiring while preserving dependency and full scope."
  - plan: "02-09"
    dimension: scope_sanity
    severity: warning
    description: "12 modified files exceed the 10-file warning threshold."
    fix_hint: "Split contract generation from public guide routes/browser compatibility checks."
  - plan: "02-14"
    dimension: scope_sanity
    severity: warning
    description: "11 modified files exceed the 10-file warning threshold."
    fix_hint: "Split guarded dispatch from complete pilot driver and actual evidence execution."
  - plan: "02-17"
    dimension: scope_sanity
    severity: warning
    description: "12 modified files exceed the 10-file warning threshold."
    fix_hint: "Split dependency/CI, discovery/release gating and feedback maintenance."
```

Return to planner for targeted revision, then recheck the revised DAG, scopes and command map. External account/client/staffing decisions are already correctly gated and are not themselves reasons to stop local implementation planning.
