# Rari Agentic OS Roadmap — Write Plan (v2)

**Scope:** Write-only. Create one Markdown file. No code, no migrations, no edge functions, no archiving yet.

## Improvements over v1

1. **Add a 1-page TL;DR at the top** — exec summary (problem, bet, 6/9/12-month outcomes, top 3 risks). So a non-technical reader gets the whole story in 60 seconds.
2. **Add a "Decisions Locked" table** — captures your answers (autonomy = read+draft, voice = text-first, scope = federated, action surfaces = bookings/CRM/messages/pricing, intel = Perplexity+Firecrawl+travel APIs) so future-you doesn't relitigate them.
3. **Add an "Explicitly Out of Scope (v1)"** section — autonomous bookings, autonomous refunds, autonomous outbound messages, autonomous pricing changes. Prevents scope creep.
4. **Add "Success Metrics & Kill Criteria" per phase** — e.g. Phase 2 ships only if draft acceptance ≥ 60%; Phase 5 ships only if ≥3 tenants opt in. Each phase has a measurable gate, not just a feature list.
5. **Add "Reversibility & Blast Radius"** column to every action surface — who it affects, how to undo, max damage if it misfires. Forces honest thinking before autonomy.
6. **Add "Open Questions / Spikes Needed"** per phase — things we genuinely don't know (e.g. DO + Mastra cold-start latency, pgvector recall@k on tenant data, ElevenLabs per-agent cost at scale). Distinguishes plan from research.
7. **Add a "Glossary"** — RAG, HNSW, Durable Objects, Mastra, Helicone, Langfuse, Braintrust, k-anonymity. So non-technical stakeholders can read it.
8. **Add "Dependencies & Sequencing diagram"** (ASCII) — shows which phases block which, where parallel tracks exist. Prevents accidental serial execution of independent work.
9. **Add "Cost envelope"** — rough monthly $ for LLM, embeddings, voice, intel APIs at 10 / 50 / 200 tenants. Order-of-magnitude, not a quote.
10. **Add "Migration & Rollback notes"** — for each schema change planned in later phases, note the rollback path. Plan-level, not SQL.
11. **Split "Risks" into Technical / Product / Trust&Safety / Business** — currently one bucket, hides distinct mitigations.
12. **Add an Appendix linking to the 23 root `RARI_*.md` files** with a 1-line summary of each, marked "archive after approval." Makes the archive decision auditable instead of opaque.

## Final file structure

`docs/rari/AGENTIC_OS_ROADMAP.md` containing, in order:

1. TL;DR (1 page)
2. Decisions Locked
3. Out of Scope (v1)
4. Glossary
5. Phase 0 → Phase 6 (each with: goal, deliverables, success metrics, kill criteria, reversibility, open questions, dependencies)
6. Stack summary
7. Cost envelope (10 / 50 / 200 tenants)
8. Risks (Technical / Product / Trust&Safety / Business)
9. Sequencing diagram (ASCII)
10. Appendix A — Existing `RARI_*.md` inventory (23 files, 1-line each, archive recommendation)
11. Appendix B — Side-prototype spikes worth running in parallel

## What this turn does

- Create `docs/rari/AGENTIC_OS_ROADMAP.md` only.
- No file moves, no archive, no code, no DB. Archive of the 23 `RARI_*.md` files happens only after you approve the roadmap and explicitly green-light the archive.

## Want any of these dropped?

If you'd rather keep it leaner, the easy cuts are: Cost envelope (#9), Glossary (#7), Appendix B (#11). Everything else earns its keep.
