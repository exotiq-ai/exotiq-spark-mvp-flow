## ISSUES FOUND

**Phase:** 02 — Agent discovery and isolated demo-fleet pilot
**Revision:** iteration 2
**Plans checked:** 22; 41 tasks; 12 declared waves
**Issues:** 1 blocker; 0 unresolved warnings from iteration 1; 1 informational label correction

All ten requirement IDs remain substantively covered. All22 plans pass the actual GSD plan-structure validator. Every task has read-first paths, acceptance criteria and automated commands. Dependencies are acyclic, declared waves match the dependency formula and same-wave declared source ownership is disjoint. The previous research, preserved-lab, Edge typechecking, command-map and excessive-file-scope findings have been resolved.

### Remaining blocker — wave scheduling prevents independent local progress

Plan02-10 is an unresolved external-resource decision checkpoint in wave1. Its action promises “All independent local plans continue; only resource-dependent plans await selection.” CONTEXT.md locks that behavior. Actual execute-phase.md waits for **all agents in each wave** and explicitly waits for checkpoint responses before advancing; its --wave safety check also refuses later waves while earlier plans remain incomplete. Therefore ordinary /gsd-execute-phase2 cannot perform local payment recovery, operator UI, discovery routes/guides or maintenance while resource selections remain pending. A valid graph does not fix this runtime scheduling contradiction.

Move the blocking02-10 checkpoint after all stage-independent local work. For example, depend on02-05 and02-22 (whose chain contains public guides, discovery, native worker checks and maintenance), then recompute the hosted11→12→13→14→21→15→16→18 chain. Keep early questions and read-only candidate evidence already collected; do not invent resource approval, silently skip a checkpoint, use unsupported wave bypasses or automatically enable auto-chain. An explicitly supported dependency-aware continuation workflow would also work if concretely supplied and verified, but standard execution currently lacks it.

Plan21 still says “plan17 feedback input” in its action while its output correctly identifies22. Correct the action label to22; this is informational because the artifact and consumer dependencies are already correctly wired.

### Resolved checks

- Research: six questions have explicit RESOLVED planning dispositions; actual account/budget/product/staffing facts remain pending at named gates.
- Plan03: new owned UUID lab, empty independently labeled volume/network/image and reviewed partial bootstrap only. Existing stopped manifests, volumes and bookings are preserved; no old restart/initdb shortcut.
- Plans04/05: owned official checksum-verified pinned native Deno bootstrap; strict native import/lock/profile checks cover actual scheduler/reconciler/operator entrypoints and transitive adapters. No declarations hide real types; missing runtime remains an explicit bootstrap/failure gate. Deployed runtime parity remains separate in12.
- Validation map: all41 tasks, .test.tsx/.spec.ts and browser/typecheck configurations have exact current existence/owner data. Missing tests require meaningful owned RED first; no executed proof is invented.
- Splits19/20/21/22 preserve scope and wiring; all plans now have at most10 declared files and3 tasks. The boundary-sized04/05 plans have explicit owned test-first units rather than one unbounded implementation task.
- Stage deployment12 waits for final frontend/public guides and deploys the genuine protected operator SaaS app. All reviewed03/05/07 SQL precedes managed schema/provider acceptance. Effective schema/role/GUC/runtime proof is retained.
- Actual pilot receipt21 refreshes source-backed frontend discovery/profile artifacts and deployed stage guides before named-agent trials. Feedback22 is consumed and actual observations ingested in15/16 before18.
- All-attempt/both-leg financial evidence, immutable history, lease/settlement/inventory races, human authority, private surfaces, real-client/cold-discovery distinction and separately authorized live launch boundaries remain intact.

### Dimension 8 — Nyquist

VALIDATION.md exists. All41 tasks have automated checks; all implementation waves have continuous meaningful feedback with no three-task gap. New browser/SQL/provider gates are separately labeled integration acceptance with preceding quick checks. nyquist_compliant:false and wave_0_complete:false truthfully remain pending execution. The scheduling issue must be repaired before the execution entrypoint can fulfill this strategy.

### Dimension 10 — AGENTS.md

SKIPPED: no AGENTS.md at <LOCAL_HOME> or either isolated source root, and no repository skill directories. The explicit gsd-plan-phase workflow is followed.

### Structured issue

```yaml
issues:
  - plan: "02-10"
    task: 1
    dimension: dependency_correctness
    severity: blocker
    description: "Wave1 external checkpoint stops all later local work under the actual GSD wave/checkpoint scheduler, contradicting promised independent progress."
    fix_hint: "Move blocking selection after every stage-independent local deliverable, e.g. dependencies02-05 and02-22; recompute hosted chain/waves and validation map. Preserve early questions, genuine resource gates and disabled auto-chain."
  - plan: "02-21"
    task: 1
    dimension: key_links_planned
    severity: info
    description: "Action retains a stale plan17 feedback label; the output correctly names22."
    fix_hint: "Change the action reference to plan22."
```

Static planning verification only. No implementation, hosted acceptance, actual named-client test or production activation was performed by this review.
