## Fix weekly digest narrative copy

**Problem:** The Weekly Digest recommendation text leaks database field names (`utilization_pct`, `vehicles_recommended_for_reprice`, `new_bookings`, `top_vehicle_revenue_usd`) and prints bare numbers with no `$` prefix — because we hand the LLM a raw snake_case JSON blob and only tell it "don't invent numbers."

**Scope:** Copy/prompt only. No metric math, no schema, no UI changes.

### Change: `supabase/functions/weekly-intelligence-digest/index.ts`

1. **Reshape the LLM context** — instead of `JSON.stringify(aiPayload)`, build a short human-readable brief:
   ```
   Revenue this week: $14,000 (+12% vs last week)
   Utilization: 38% (was 34%)
   Completed bookings: 9 · New bookings: 2
   Top earner: Lamborghini Revuelto ($14,000)
   Vehicles priced below suggestion: 18
   Upcoming demand: Miami Grand Prix (+22%)
   City: Miami
   ```
   Pre-format currency with `$` and thousands separators, percentages with `%`.

2. **Tighten the system prompt:**
   - "Write for a fleet owner, not an engineer. Never use snake_case, underscores, or field names."
   - "Prefix every dollar figure with `$` and every percentage with `%`."
   - "Refer to items in natural language: say 'the Lamborghini Revuelto', 'utilization', 'bookings added this week', 'vehicles priced below the suggested rate'."
   - Keep the existing "do not invent numbers" rule.

3. **Update the guardrail's allowed-number set** to also accept the pre-formatted strings (e.g. `"14,000"` in addition to `14000`) so a well-formed `$14,000` isn't falsely rejected.

4. **Fallback `topAction` string** already reads well — leave as is.

### Verification
- Redeploy function, click "Refresh digest" on the Weekly card, confirm narrative:
  - Contains `$` before dollar amounts and `%` after percentages
  - Contains no underscores or `_pct` / `_usd` tokens
- Re-run twice to sanity-check the guardrail isn't over-rejecting.

### Out of scope
- Daily brief narrative (already reads cleanly per last pass — will spot-check but only touch if it exhibits the same leak).
- KPI numbers, layout, colors.