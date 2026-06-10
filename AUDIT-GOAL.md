# GOAL: Full Examination, Repair, and Optimization of app.exotiq.ai

You are Claude Fable 5 running in Claude Code. You are the **orchestrator**. You do not write most of the code yourself. You plan, dispatch sub-agents, review their output, enforce quality, and merge results. By the end of this session, work must be **done and committed**, not planned for later.

---

## 1. Mission

Run a comprehensive examination of this repository (app.exotiq.ai) and:

1. Find and **fix** all bugs you can verify
2. Identify and **apply** performance and code-quality optimizations
3. Identify and **apply** acceptable UI/UX improvements (boundary in Section 6)
4. Apply safe refactors per the policy in Section 7; flag structural ones
5. Identify feature improvements: implement small ones, flag large ones
6. Locate every plan/spec markdown file in the repo, stress test each plan against the actual codebase, and flag gaps, contradictions, or unimplemented promises
7. Stand up a CI pipeline that runs the test suite on every PR
8. Verify everything through tests, run in a loop until green
9. Produce a final report of everything improved, everything flagged, and where each change lives

The deliverable is working code in reviewable PRs plus a report. A list of suggestions with no commits is a failed session.

---

## 2. Hard Rules (non-negotiable)

- **Never commit to or push main.** All work happens on feature branches.
- **Never touch production.** No production Supabase keys, no production Stripe keys, no live migrations. If you find production credentials in the repo or env files, do not use them, and flag the exposure as a security finding.
- **No destructive operations** on any database that contains data you did not seed yourself.
- **Stripe stays in test mode** at all times.
- **Lovable coexistence.** Lovable handles UI generation and has Supabase MCP access to the hosted project. Treat the hosted Supabase instance as production: never connect to it. All runtime work happens on the Supabase local stack. Any schema change you need is written as a migration file in the repo and either flagged or converted into a Lovable prompt; it is never applied to the hosted instance by you.
- **Freeze window.** This session assumes no Lovable edits occur while it runs (Gregory enforces this). Lovable syncs with main; your branches are invisible to it until merged, which is your isolation mechanism. No worktrees are needed for this.
- **Dependency policy:** patch and minor version updates may be applied if the full test suite is green afterward. Major version bumps are flag-only, with the changelog summarized and risk assessed in FLAGGED.md. Never add a new dependency without justification recorded in the report; nothing with licensing risk or paid tiers.
- **Flag, don't build, major overhauls.** Definition: anything that restructures navigation, rearchitects a data model, changes the checkout flow logic, alters pricing/fee logic, or would take a human reviewer more than ~15 minutes to evaluate in a single PR. These go in FLAGGED.md with a written proposal, not into code.
- If a fix and a flag conflict, flag wins. When uncertain whether something is a tweak or an overhaul, treat it as an overhaul.

---

## 3. Environment Setup (Phase 0, gating)

Before any analysis or fixes:

1. Read the repo root: README, package.json, env examples, CI config, and any setup docs.
2. Stand up the app locally. Use the Supabase local stack (`supabase start`). Seed minimal test data if needed.
3. **Schema drift check.** Because Lovable applies schema changes via Supabase MCP, the repo's migration files may not match the actual hosted schema. If a schema dump or dev-project credentials are provided, pull the real schema (`supabase db pull`) and reconcile against the repo. If not, reconstruct the schema from code, types, and migrations, mark it as unverified, and list suspected drift in FLAGGED.md. All RLS and database testing runs against your best-reconciled local schema, with confidence level stated in findings.
4. **Gate:** the app must boot and serve the main routes locally. If you cannot get it running after reasonable effort, stop fix work, document exactly what is blocking in FLAGGED.md, and proceed in static-analysis-only mode (you may still fix issues verifiable without runtime, but mark them as not runtime-verified).
5. Create the checkpoint file (Section 9) and a working log.

---

## 4. Test Harness and CI (Phase 1, gating)

Assess existing test coverage honestly:

- If coverage is decent: catalog the suites, make sure they pass on main, and use them as the verification baseline.
- If coverage is thin or absent (likely): **build a smoke-test harness first.** Priority order:
  1. Auth flows (sign up, sign in, session handling)
  2. The renter booking/checkout flow end to end with Stripe test mode
  3. Operator dashboard core actions
  4. Any payment, fee calculation, or payout logic (unit tests, exhaustive on edge cases: the 10% platform fee math must be bulletproof)
  5. API routes and Supabase RLS behavior (verify policies actually restrict what they claim to)
- Do not aim for 100% coverage. Aim for a harness strong enough that "tests pass" actually means "the app works."

**CI deliverable:** create a GitHub Actions workflow that runs lint, typecheck, and the full test suite on every PR. If a CI config already exists, extend it to run the new suite rather than replacing it. The harness plus CI workflow lands together as PR #1. Every subsequent category PR must pass this CI.

---

## 5. Orchestration Architecture

You are the orchestrator. Set up sub-agents in `.claude/agents/` with explicit model assignments, then dispatch work to them. Suggested roster:

| Agent | Model | Role |
|---|---|---|
| `architect-reviewer` | Opus 4.6 | Deep architecture review, gnarly bug diagnosis, security analysis, RLS/auth review, refactor candidate identification, stress-testing the md plans against the codebase |
| `implementer` | Sonnet | The bulk of fix and improvement implementation, test writing |
| `sweeper` | Haiku | Wide cheap passes: dead code, unused deps, `npm audit`, lint, console.logs, TODO/FIXME inventory, broken links, typo sweep |
| `ui-reviewer` | Sonnet | UI/UX audit within the Section 6 boundary, accessibility scan, Lighthouse runs against the local server |
| `verifier` | Sonnet | Runs the test loop, reproduces bugs before fixes and confirms after, adversarial review of implementer's diffs |

Rules of engagement:

- **Read-only analysis runs in parallel.** Dispatch architect-reviewer, sweeper, and ui-reviewer simultaneously in Phase 2. They write findings to structured markdown files in an `/audit/` working directory, never to source code.
- **Write work runs sequentially per category.** No two agents write source code at the same time. No git worktrees needed; one writer at a time, one branch per category.
- **You review everything.** Before any commit, you (Fable) review the diff against the finding it claims to fix. The verifier independently confirms tests pass. Implementer output is never trusted unreviewed.
- Keep your own context lean: have sub-agents return summaries and file paths, not full file dumps.

---

## 6. UI/UX Lanes and Lovable Handoff

Lovable owns the UI generation loop, so every UI/UX finding is sorted into one of three lanes:

**Lane 1, FIX-DIRECT (Fable applies in code):** mechanical fixes Lovable is unlikely to regenerate over and that benefit from test verification:
- Copy fixes in code: typos, unclear labels, inconsistent terminology
- Accessibility attributes: alt text, ARIA, focus states, keyboard nav
- Form validation logic and error-message wiring
- Broken links, broken image references, dead routes
- Functional UI bugs with a testable repro (broken handlers, state bugs, layout overflow caused by logic)

**Lane 2, LOVABLE-PROMPT (handed off, not coded):** visual and design-flavored changes where Lovable is the right author:
- Spacing, alignment, padding, contrast, font-size inconsistencies
- Missing or weak loading states, empty states, error states (the visual treatment)
- Mobile responsiveness polish
- Hover/transition/visual-state improvements
- Any change inside components Lovable clearly generated and actively iterates on, when the change is stylistic rather than functional

Lane 2 items go into `LOVABLE-PROMPTS.md` at repo root. Each prompt must follow these rules: one change per prompt; name the exact page and component; describe the desired outcome and acceptance criteria, not the implementation; explicitly instruct Lovable to leave unrelated files untouched; sequence prompts in dependency order so Gregory can paste them top to bottom. Write them in Gregory's voice, ready to paste with zero editing.

**Lane 3, FLAG (no change, written proposal only):**
- Navigation structure or information architecture
- Brand elements: logo usage, brand colors, typography system
- The checkout flow's screen sequence or step logic
- Anything touching pricing display logic or fee presentation
- Wholesale redesigns of any page

When a finding sits between Lane 1 and Lane 2, prefer Lane 2. A duplicated Lovable prompt costs nothing; a Fable-authored visual change that Lovable later regenerates over costs the work silently.

---

## 7. Refactoring Policy

You have case-by-case judgment on refactoring, exercised inside these guardrails. Every refactor candidate must pass ALL of the following before implementation:

1. **Behavior-preserving.** No functional change rides along. A refactor commit and a fix commit are never the same commit.
2. **Test-gated.** The affected code paths are covered by tests that pass before and after. If coverage doesn't exist, either write it first or skip the refactor.
3. **Value test.** It must measurably reduce future bug risk, unblock another fix in this session, or eliminate genuine duplication. "Cleaner" or "more idiomatic" alone does not qualify.
4. **Size cap.** Reviewable by a human in under 15 minutes per PR. Anything bigger is flagged with a written proposal instead.

Likely good candidates in a codebase of this origin: duplicated components, copy-pasted Supabase query logic, oversized components doing five jobs, repeated fee-calculation snippets. Structural refactors (folder architecture, data-layer reorganization, framework pattern migrations) are always flag-only.

Refactors land on `audit/refactors` and run AFTER all functional categories complete, only if context budget remains. Functional fixes always outrank refactors.

---

## 8. Phased Execution Plan

**Phase 0: Recon and boot** (Section 3). Gate: app runs locally.

**Phase 1: Test harness + CI** (Section 4). Gate: baseline suite green, CI workflow committed. PR #1.

**Phase 2: Parallel analysis.** Dispatch read-only agents. Outputs into `/audit/`:
- `bugs.md` (each with severity, reproduction steps, suspected root cause)
- `performance.md` (bundle size, query patterns, N+1s, missing indexes, render waste, Lighthouse scores on key renter-facing pages with specific failing items)
- `security.md` (RLS gaps, exposed keys, injection surfaces, auth holes, and explicitly: rate limiting on auth/booking/API endpoints and SMS-verification abuse exposure, since unprotected SMS endpoints invite SMS pumping fraud with real Twilio cost)
- `observability.md` (swallowed errors, missing error tracking, silent failure paths, especially in payment flows)
- `dependencies.md` (npm audit results, outdated packages split into patch/minor vs major)
- `code-quality.md` (sweeper output)
- `refactors.md` (candidates, each pre-screened against Section 7 criteria)
- `uiux.md` (every item tagged FIX-DIRECT, LOVABLE-PROMPT, or FLAG per Section 6 lanes)
- `plan-stress-tests.md` (every plan/spec md in the repo, mapped against reality: implemented, partially implemented, contradicted, or abandoned, with risks called out)
- `features.md` (improvement ideas, each tagged SMALL-BUILD or FLAG)

**Phase 3: Triage.** Consolidate everything into a prioritized TRIAGE.md: Fix Now (this session), Flag for Gregory, Won't Fix (with reasoning). Priority order: security > data-integrity bugs > functional bugs > performance > UI/UX > dependencies > small features > refactors > code quality.

**Phase 4: Implementation, category by category.** For each category, in priority order:
1. Branch off main: `audit/security`, `audit/bugs`, `audit/performance`, `audit/uiux`, `audit/dependencies`, `audit/features`, `audit/refactors`, `audit/code-quality`
2. Verifier reproduces the issue (test or manual repro) BEFORE the fix where feasible
3. Implementer fixes, with a test accompanying every bug fix
4. Verifier runs the full suite in a loop until green; any regression goes back to implementer
5. You review the final diff, then commit atomically (one finding = one commit where practical)
6. Open a PR for the category with a summary of every change; CI must pass
7. Update the checkpoint file, then move to the next category

**Phase 5: Stress and load testing.** Against the LOCAL server only:
- Load-test critical API routes and the booking flow (e.g., k6 or autocannon)
- Concurrency tests on booking creation (double-booking race conditions are a kill-shot bug for a rental marketplace, hunt for them specifically)
- Large-data rendering tests (lists with hundreds of vehicles/bookings)
- Findings fixable within scope: fix in a final pass on the relevant branch. Otherwise FLAGGED.md.

**Phase 6: Final report.** Produce at repo root on an `audit/report` branch:
- `IMPROVEMENTS.md`: every change made, grouped by category, with commit hashes and PR links, plus before/after evidence where measurable (test counts, bundle size, Lighthouse scores, load-test numbers, vulnerabilities resolved)
- `FLAGGED.md`: every item needing Gregory's decision, each with context, your recommendation, and estimated effort
- `LOVABLE-PROMPTS.md`: all Lane 2 UI/UX items as ready-to-paste Lovable prompts per Section 6 rules, plus any flagged schema changes rewritten as Lovable prompts where Lovable is the right applier
- Updated README reflecting any setup, testing, or CI changes
- A short executive summary at the top of IMPROVEMENTS.md: 10 lines max, what state the app was in, what state it is in now, the three most important flagged items

---

## 9. Checkpoint and Resume Protocol

Maintain `/audit/CHECKPOINT.md` updated after every phase and every category completion: current phase, completed items, in-flight branch, next action. If this session dies and is restarted, read CHECKPOINT.md first and resume from the last completed step. Commit audit working files to the `audit/report` branch periodically so nothing lives only in context.

---

## 10. Definition of Done

- [ ] Test harness exists, is green, and CI runs it on every PR (PR #1 opened)
- [ ] Every Fix Now item from triage is implemented, tested, committed, and in a PR
- [ ] All category PRs are open with clear descriptions and passing CI
- [ ] Stress tests have run and results are recorded
- [ ] Every plan md in the repo has been stress-tested with findings recorded
- [ ] IMPROVEMENTS.md, FLAGGED.md, and LOVABLE-PROMPTS.md exist and are accurate; README updated
- [ ] Nothing was pushed to main, nothing touched production
- [ ] CHECKPOINT.md reflects completion

If context or time runs short, do not abandon work silently: finish the in-flight category, commit, update the checkpoint, and write the report covering completed work, clearly marking which phases did not run.

---

## 11. Operating Posture

Be skeptical of your own sub-agents. Implementer claims without verifier confirmation are unverified. "Tests pass" means the full suite, not the one test touched. Prefer ten small verified fixes over one ambitious unverified refactor. When the codebase contradicts a plan document, the codebase is reality and the plan is the thing under test.
