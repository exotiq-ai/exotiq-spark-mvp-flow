# Rari Agentic OS Roadmap

> Canonical source of truth for evolving Rari from a chat assistant into a federated, tenant-aware Agentic Operating System for the exotic-fleet vertical. Supersedes the 24 root `RARI_*.md` documents (see Appendix A).

---

## 1. TL;DR (1-page exec summary)

**Problem.** Rari today is a stateless chat assistant trained on a ~6-month-stale snapshot. Tenants are starting to expect agents that *know their live data*, *anticipate*, and *do work* — not just answer. The category is moving fast (OpenAI Operator, Anthropic Computer Use, ElevenLabs Agents, Mastra, Cloudflare Agents, local Hermes-style models). If we don't move now, "Rari" becomes a brand on top of someone else's agent.

**Bet.** Rari becomes a **federated, per-tenant Agentic OS**: it knows each tenant's live database (RAG), follows that tenant's playbook (policies + tone), pulls in industry intelligence (Perplexity, Firecrawl, travel/weather APIs), and progressively earns autonomy on a narrow set of high-value actions (bookings, CRM tasks, message drafts, pricing). Cross-tenant learning happens **only** through anonymized federated patterns with explicit opt-in.

**Stance for v1.** Read + Draft only. Rari proposes, humans approve. Autonomy is unlocked per-action, per-tenant, only after measurable proof.

**6 / 9 / 12-month outcomes.**
- **6 months** — Phases 0–3 shipped. Live-data RAG, per-tenant playbooks, industry intel briefs, draft layer (4 surfaces), confirm-to-act flow, full audit log.
- **9 months** — Phases 4–5. Voice for demos/mobile, federated pattern mining (opt-in), tenant-policy enforcement at runtime.
- **12 months** — Phase 6. Bounded autonomy on proven flows only (never bookings, refunds, outbound messages, or pricing in v1).

**Top 3 risks.** (1) Skipping the autonomy ladder and shipping autonomous actions before draft acceptance proves the model is trustworthy. (2) Treating the voice session as state, which breaks multi-device continuity. (3) A monolithic super-prompt that becomes impossible to evaluate or roll back.

---

## 2. Decisions Locked

| Decision | Choice | Why |
|---|---|---|
| Time horizon | 6–12 months, phased | Phase gates beat a "big bang" launch. |
| Agent autonomy v1 | Read + Draft only | Earn trust before earning permission. |
| Voice + runtime | Open, best-in-class (ElevenLabs Agents leading) | Don't lock in early; voice is text + a transport. |
| Knowledge refresh scope | All four: live tenant data (RAG), industry intel, per-tenant playbook, platform capability catalog | These are the four legs of the stool. |
| Tenant scope of "acting" | Federated network effects (anonymized, opt-in) | Compounding moat without leaking tenant data. |
| Voice priority | Text-first; voice for demos + mobile | Text is the substrate; voice is a surface. |
| Action surfaces (in order) | Booking ops → CRM + fleet tasks → Messaging drafts → Pricing changes | Highest leverage first; all start as drafts. |
| Industry intel sources | Perplexity Sonar, travel/weather/flights APIs, Firecrawl/Exa for competitor pricing | Three layers: synthesis, signals, raw scrape. |

---

## 3. Explicitly Out of Scope (v1)

Rari will **not** do any of the following without a human pressing "Confirm":

- Create, modify, or cancel bookings autonomously.
- Issue refunds or charge cards.
- Send outbound messages (SMS, email, WhatsApp) to renters or leads.
- Change pricing live on inventory.
- Take any action on a tenant that has not opted in to that action class.
- Share any tenant-identifying data across tenants. Federated learning is anonymized + k-anonymity ≥ 5.

These are revisited only in Phase 6, per-action, per-tenant, behind measurable unlock criteria.

---

## 4. Glossary (for non-technical readers)

- **RAG (Retrieval-Augmented Generation).** Before the AI answers, pull the most relevant chunks from a knowledge store and stuff them into the prompt. The AI "knows" without being retrained.
- **Embeddings / pgvector / HNSW.** Turning text into numeric vectors so we can find "similar" content fast. HNSW is the index type that makes this scale.
- **Mastra.** Open-source TypeScript framework for building agents with tools, memory, and workflows. Sits on top of model providers.
- **Cloudflare Durable Objects (DO).** A single-tenant, single-instance runtime. Perfect for "one live agent session per tenant" without shared-state bugs.
- **Helicone.** Proxy in front of LLM calls that logs every request/response, cost, and latency.
- **Langfuse.** Trace + evaluation tool. Lets us replay an agent's reasoning step-by-step and grade it.
- **Braintrust.** Eval-in-CI. Run a test suite of "scenarios" against the agent on every change, gate deploys on pass rate.
- **Federated learning.** Learn patterns across tenants without ever moving raw tenant data.
- **k-anonymity ≥ 5.** A pattern is only surfaced if it's true for at least 5 tenants, so no single tenant is identifiable.
- **Perplexity Sonar / Firecrawl / Exa.** Three flavors of "give my agent the live web": synthesized answers, full-page scrape, neural search.

---

## 5. Phases

Each phase has: **Goal · Deliverables · Success metrics · Kill criteria · Reversibility · Open questions / spikes · Dependencies.**

### Phase 0 — Foundation (weeks 1–3)

- **Goal.** Make Rari changeable. Today it's not.
- **Deliverables.**
  - Archive the 24 root `RARI_*.md` files into `docs/rari/_archive/` (see Appendix A).
  - New tables: `rari_tool_registry`, `tenant_policies` (JSONB), `agent_audit_log`, `rari_drafts`, `rari_approvals`, `intel_briefs`, `rari_knowledge_chunks` (pgvector).
  - `team_id → elevenlabs_agent_id` mapping table.
  - Helicone proxy in front of every LLM call.
  - Feature flag `rariAgenticOs` (off in prod).
- **Success metrics.** 100% of LLM calls flowing through Helicone; flag toggles cleanly per team.
- **Kill criteria.** If we can't get Helicone to <50ms overhead, drop it and use Langfuse-only.
- **Reversibility.** All additive. Flag-off restores current behavior.
- **Open questions / spikes.** Helicone vs Portkey vs OpenRouter for the proxy layer; cost of pgvector HNSW on our current Postgres tier.
- **Dependencies.** None. This unblocks everything.

### Phase 1 — Knowledge Refresh (weeks 3–6)

- **Goal.** Rari knows what's true *now*, per tenant, plus the world.
- **Deliverables.**
  - `rari-embed-worker` edge function. Postgres triggers on the core tenant tables enqueue embedding jobs. HNSW index on `rari_knowledge_chunks`.
  - Per-tenant playbook: Markdown in `tenant_policies.playbook`, injected into the system prompt at runtime.
  - `rari-intel-refresh` cron (weekly): Perplexity Sonar synthesis + Firecrawl/Exa competitor scrape + travel/weather/flights APIs → `intel_briefs`.
  - Tool registry auto-discovered via Vite glob (no more "Rari forgot it can do X").
- **Success metrics.** Recall@5 ≥ 0.85 on a hand-labeled tenant Q&A set; intel briefs rated "useful" by ≥ 3 pilot tenants.
- **Kill criteria.** If recall@5 < 0.6 after tuning, switch chunking strategy or move to hybrid (BM25 + vector).
- **Reversibility.** RAG is additive context. Disable the retrieval step and Rari falls back to pre-Phase-1 behavior.
- **Open questions / spikes.** Trigger-driven vs CDC for embedding refresh; pgvector recall@k on real tenant shapes; cost of Perplexity Sonar at weekly cadence × N tenants.
- **Dependencies.** Phase 0.

### Phase 2 — Draft Layer (weeks 6–10)

- **Goal.** Rari proposes. Humans approve. Nothing else changes in production data.
- **Deliverables.**
  - 4 draft tools: `draft_booking_change`, `draft_customer_task`, `draft_fleet_task`, `draft_outbound_message`.
  - `rari_drafts` table; "Rari Inbox" UI per team with Approve / Edit / Reject.
  - Langfuse trace ingestion on every draft generation.
- **Success metrics.** **Phase 2 only ships to GA if draft acceptance ≥ 60%** across pilot tenants for ≥ 2 weeks.
- **Kill criteria.** Acceptance < 30% → return to Phase 1, fix retrieval and playbooks before proceeding.
- **Reversibility.** Drafts never mutate domain data. Empty the table = zero blast radius.
- **Open questions / spikes.** UX of the inbox (per-record vs unified queue); diff rendering for edits to existing records.
- **Dependencies.** Phase 1 (RAG + playbooks).

### Phase 3 — Act with Confirmation (weeks 10–16)

- **Goal.** Promoted drafts execute as real mutations, with policy enforcement and undo.
- **Deliverables.**
  - Each draft tool gets a paired `commit_*` mutation, gated by `tenant_policies` JSONB (which actions, which roles, which dollar/risk thresholds).
  - Every commit writes an `undo_payload` to `agent_audit_log` (reverse mutation pre-computed).
  - Cloudflare Durable Object per active session for ordering + idempotency.
  - Braintrust eval suite gates every deploy of a commit path.
- **Success metrics.** ≥ 95% of commits have a working undo replay; zero cross-tenant data leaks in Braintrust suite.
- **Kill criteria.** Any P0 cross-tenant leak → halt Phase 3, full audit.
- **Reversibility.** Per-action policy kill-switch; per-commit undo via `undo_payload`.
- **Open questions / spikes.** DO + Mastra cold-start latency; tenant-policy load latency on first message of session.
- **Dependencies.** Phase 2 (the draft set is the action set).

### Phase 4 — Voice + Mobile (weeks 16–22)

- **Goal.** Same brain, new surfaces. Voice is a transport, not a separate agent.
- **Deliverables.**
  - Per-team ElevenLabs Agent IDs, bound to the same tool registry + policies as text.
  - Push-to-talk on web; lock-screen "Confirm" taps on mobile.
  - Demo mode (`useDemoOrchestrator`) showing Rari narrating a tenant's day.
  - Latency budget: <800ms voice-first-token in 95th percentile.
- **Success metrics.** Demo-to-trial conversion lift vs text-only; mobile confirm-tap → approve rate ≥ text inbox.
- **Kill criteria.** Voice cost per active tenant exceeds 2× text cost without measurable conversion lift → pull back to text-only with voice for demos.
- **Reversibility.** Voice is a surface. Disable the surface, text remains.
- **Open questions / spikes.** ElevenLabs per-agent pricing at scale; barge-in UX during multi-step confirms; how to render "diff" in voice.
- **Dependencies.** Phase 3 (the agent must already be able to act safely).

### Phase 5 — Federated Network Effects (weeks 22–30)

- **Goal.** Each tenant gets smarter because the others exist — without ever seeing the others' data.
- **Deliverables.**
  - `rari-pattern-miner` nightly job; output to `federated_patterns`.
  - Strict anonymization + k-anonymity ≥ 5 + differential-privacy noise on numeric outputs.
  - Per-tenant opt-in toggle, default **off**.
  - "Patterns" panel surfacing things like "tenants in your region saw +18% inquiries on F1 weekends."
- **Success metrics.** ≥ 3 tenants opt in within 30 days of launch; ≥ 1 pattern adopted into a tenant playbook.
- **Kill criteria.** Any reidentification finding in internal red-team → disable federation, return to single-tenant learning.
- **Reversibility.** Toggle off + truncate `federated_patterns`.
- **Open questions / spikes.** What's the minimum useful pattern surface (pricing? demand? maintenance?); legal review of cross-tenant insight surfacing.
- **Dependencies.** Phase 3 (we need clean audit data to mine from).

### Phase 6 — Bounded Autonomy (weeks 30–52)

- **Goal.** Earn autonomy, per action, per tenant.
- **Deliverables.**
  - Unlock criteria *per action category*: ≥ 20 examples of human-approved drafts at ≥ 95% acceptance, **and** explicit tenant-admin grant.
  - Auto-demote if error rate > 5% over a rolling window.
  - Initial autonomous surface: narrow, low-risk, fully-reversible tasks only (e.g. auto-tag a CRM lead, auto-draft-and-schedule an internal task). **Never** in v1: bookings, refunds, outbound messages, pricing.
- **Success metrics.** ≥ 1 tenant running ≥ 1 autonomous flow for ≥ 30 days with zero rollbacks.
- **Kill criteria.** Any unauthorized mutation, any cross-tenant leak, any irreversible action → halt and audit.
- **Reversibility.** Auto-demote rule + per-action kill switch + complete audit log with undo payloads.
- **Open questions / spikes.** Right shape of the unlock dashboard for tenant admins; insurance / liability framing.
- **Dependencies.** Phases 3 + 5.

---

## 6. Stack Summary

| Layer | Choice | Why |
|---|---|---|
| Orchestration | Mastra + Inngest | TypeScript-native, tool-first, durable workflows. |
| Per-tenant runtime | Cloudflare Durable Objects | One live agent per tenant, no shared-state bugs. |
| Voice | ElevenLabs Agents | Best-in-class latency + tool calling. |
| Knowledge | Postgres + pgvector + HNSW | Already in stack; no new dependency. |
| Industry intel | Perplexity Sonar + Firecrawl/Exa + travel/weather APIs | Synthesis + scrape + signals. |
| Observability | Helicone (proxy) + Langfuse (traces) | Cost + replay. |
| Eval CI | Braintrust | Gate deploys on scenario pass rate. |

---

## 7. Cost Envelope (order-of-magnitude, monthly)

Rough — refine after Phase 1 telemetry.

| Item | 10 tenants | 50 tenants | 200 tenants |
|---|---|---|---|
| LLM (chat + drafts) | $200 | $1,000 | $4,000 |
| Embeddings (refresh) | $20 | $100 | $400 |
| Perplexity Sonar (weekly briefs) | $50 | $250 | $1,000 |
| Firecrawl / Exa (competitor crawl) | $100 | $400 | $1,200 |
| ElevenLabs (voice, demo-weighted) | $100 | $400 | $1,500 |
| Helicone + Langfuse + Braintrust | $100 | $200 | $500 |
| **Total** | **~$570** | **~$2,350** | **~$8,600** |

Voice scales sub-linearly with tenant count if it stays demo/mobile-only as planned.

---

## 8. Risks

### Technical
- DO + Mastra cold-start latency may exceed 800ms — mitigate with warm pool.
- pgvector recall at scale may force a move to a dedicated vector DB (Qdrant/Pinecone).
- Embedding refresh lag — mitigate with prioritized queue (recent rows first).

### Product
- Draft acceptance < 60% kills the whole thesis. **Phase 2 is the bet.**
- "Rari Inbox" becomes noise — solve with priority + auto-archive of stale drafts.
- Voice feels gimmicky if it can't act — Phase 4 deliberately follows Phase 3.

### Trust & Safety
- Cross-tenant leak through federated patterns. Mitigation: k-anonymity ≥ 5 + DP noise + red-team before launch.
- Unauthorized commits. Mitigation: per-tenant policy enforced at the commit-tool boundary, not the prompt.
- Prompt injection through tenant data or scraped competitor pages. Mitigation: untrusted-content boundaries, no shell/exec tools, strict allowlist of mutation targets.

### Business
- Vendor lock-in (ElevenLabs, Cloudflare). Mitigate by keeping the brain in Mastra (portable).
- Category moves faster than we ship. Mitigation: the autonomy ladder doesn't change even if the model changes — we keep our moat in playbooks + federated patterns.

---

## 9. Sequencing Diagram

```text
Phase 0 ─┬─> Phase 1 ─> Phase 2 ─> Phase 3 ─┬─> Phase 4 (Voice)
         │                                   │
         │                                   └─> Phase 5 (Federated) ─> Phase 6 (Autonomy)
         │
         └─> (parallel) Side spikes: DO+Mastra latency, policy load, inbox UX, intel quality
```

Phase 4 and Phase 5 are parallelizable after Phase 3. Phase 6 requires both.

---

## 10. Migration & Rollback Notes (plan-level)

- All new tables are additive. Rollback = drop table, no domain-table changes.
- `tenant_policies` is JSONB — schema-less, versioned by `policy_version` column.
- `agent_audit_log.undo_payload` is the rollback contract for Phase 3 commits.
- Feature flag `rariAgenticOs` is the master kill-switch through Phase 4.

---

## Appendix A — Existing `RARI_*.md` Inventory (archive after approval)

The following 24 files at the repo root are superseded by this document and should be moved to `docs/rari/_archive/` once you green-light the archive. One-line summary each:

1. `RARI_AGENT_CONFIG_UPDATE.md` — historical ElevenLabs agent config changes.
2. `RARI_CAPABILITIES_KNOWLEDGE_BASE.md` — early enumeration of what Rari can do (now replaced by tool registry).
3. `RARI_COMPLETE_SOLUTION_JAN_8_2026.md` — point-in-time fix writeup.
4. `RARI_DOCUMENTATION_INDEX.md` — old index, replaced by this file.
5. `RARI_ELEVENLABS_SETTINGS.md` — ElevenLabs configuration notes.
6. `RARI_ELEVENLABS_SYSTEM_PROMPT.md` — prior system prompt; will be regenerated per-team in Phase 1.
7. `RARI_ENTERPRISE_EVOLUTION_PLAN.md` — prior roadmap attempt, superseded.
8. `RARI_IMPLEMENTATION_COMPLETE.md` — historical completion note.
9. `RARI_LOVEABLE_MASTER_PROMPT.md` — old master prompt.
10. `RARI_MCP_DEPLOYMENT_TEST_JAN_7.md` — MCP deployment test log.
11. `RARI_MCP_INTEGRATION.md` — MCP integration notes.
12. `RARI_MCP_QUICK_FIX_NEEDED.md` — historical fix ticket.
13. `RARI_MCP_TEST_RESULTS_JAN_7.md` — MCP test results.
14. `RARI_NEXT_STEPS_JAN_7_2026.md` — superseded next-steps note.
15. `RARI_TODO.md` — superseded todo list.
16. `RARI_TRANSCRIPT_IMPLEMENTATION.md` — transcript pipeline notes.
17. `RARI_UI_IMPROVEMENTS.md` — UI changelog.
18. `RARI_UNIVERSAL_QUERY_SETUP.md` — universal-query setup notes (folded into Phase 1 RAG).
19. `RARI_UNIVERSAL_SOLUTION_SUMMARY.md` — summary of the above.
20. `RARI_UPGRADE_GUIDE.md` — historical upgrade guide.
21. `RARI_WEBHOOK_INTEGRATION_CORRECT.md` — webhook integration notes.
22. `RARI_WIDGET_INTEGRATION_PLAN.md` — widget integration plan.
23. `RARI_WIDGET_STATUS.md` — widget status report.
24. `RARI_WIDGET_SUMMARY.md` — widget summary.

Action: on approval, `mv RARI_*.md docs/rari/_archive/`. No content is deleted.

---

## Appendix B — Side-Prototype Spikes Worth Running in Parallel

1. **DO + Mastra latency probe.** Boot a Durable Object, instantiate a Mastra agent with a no-op tool, measure cold start. Target < 300ms.
2. **Policy load latency.** Read a 5KB `tenant_policies.playbook` + 20-tool registry at session start. Target < 50ms.
3. **Approval-queue UX prototype.** Static Figma → React stub of "Rari Inbox" tested with 3 tenants before Phase 2 code.
4. **Industry-intel brief quality.** Run Perplexity Sonar + Firecrawl on 3 tenant geos, hand-grade usefulness. Decide weekly vs daily cadence.
5. **Hermes-style local-model probe.** Evaluate whether a small local model (on tenant device or our edge) is viable for low-stakes drafts in 12+ months.
