
## Goal
Make Rari:
1) reliably know “today” (date + time) during every voice session, and
2) speak large numbers in a human way (use “thousand / million / billion” instead of reading out long digit strings), across all users and reports she references.

## What’s happening now (based on the screenshot + current code)
- We already pass `dynamicVariables['current_date']` and `dynamicVariables['current_datetime']` from `RariVoiceInterface.tsx`.
- Rari is still saying “I don’t have access to the current date…”, which strongly suggests ElevenLabs is not actually applying (or not exposing) those dynamic variables to the agent prompt in the current agent configuration.
- Also, many tool results currently return currency like `"$2000000"` or `"$123456"` which TTS will often read digit-by-digit or as awkward long numbers.

## Strategy (robust without touching ElevenLabs tool configs)
We’ll implement TWO complementary fixes so this becomes reliable even if ElevenLabs variable substitution is flaky:

### A) Always inject date + number-speaking rules via `sendContextualUpdate()` (frontend)
`@11labs/react` supports `conversation.sendContextualUpdate(text)` (confirmed in installed types). This sends context to the agent at runtime without needing ElevenLabs dashboard changes.

Implementation approach:
- In `src/components/rari/RariVoiceInterface.tsx`, add a small “send context once per session” mechanism:
  - Track a `hasSentContextRef`.
  - When the conversation transitions to `connected`, call `conversation.sendContextualUpdate(...)` once with:
    - “Today is Friday, January 31, 2026 …”
    - “When you mention money, use thousand/million/billion words; don’t read all digits/zeros.”
    - (Optionally) “If you don’t know the date, use the provided ‘Today is…’ context.”

Why this works:
- It does not depend on ElevenLabs agent prompt templates referencing `{{current_date}}`.
- It runs for every user session, automatically.

### B) Humanize numbers and dates at the TOOL OUTPUT layer (backend)
Even if the agent forgets instructions, we can make the raw data it receives “voice-friendly” so the model naturally repeats it in a clean way.

Implementation approach:
- In `supabase/functions/elevenlabs-tools/index.ts`, add helper formatters:
  1. `formatNumberWords(n)` → “1.2 thousand”, “2 million”, “3.4 billion”
  2. `formatUsdWords(amount)` → “$2 million”, “$125 thousand”, “$950”
  3. `formatDateLong(isoDate)` → “February 10, 2026”
  4. `formatDateRange(start, end)` → “February 10–14, 2026” (or “Feb 10 to Feb 14, 2026” for clarity)
- Update key tools that Rari uses most so their returned fields are already human-readable strings:
  - `get_bookings`:
    - `dates` should be long-form (not `1/31/2026`)
    - `total`, `totalRevenue`, and `summary` should use `$… million/thousand`
  - `get_recent_activity`:
    - `amount` and `description` should use `$… million/thousand`
  - `getFleetMetrics`, `getLocationMetrics`, `getPaymentSummary`, `getCustomerProfile`, `getCustomerLifetimeValue`, and any other “report-like” tools:
    - Replace `$${x.toFixed(0)}` with `formatUsdWords(x)`
    - Keep utilization as `%` but avoid awkward “0.00” styles.

To avoid breaking any consumers that might expect numbers:
- Where appropriate, return both:
  - `totalRevenueRaw: number`
  - `totalRevenue: string` (humanized)
This gives us future flexibility without losing numeric precision.

## Files involved
1) Frontend
- `src/components/rari/RariVoiceInterface.tsx`
  - Add a `useEffect` that fires once per connected session and sends:
    - current date/time context
    - number speaking rules

2) Backend function (tools)
- `supabase/functions/elevenlabs-tools/index.ts`
  - Add formatting helpers (currency + compact words + date formatting)
  - Update the most frequently used tool responses (bookings, recent activity, metrics/payments/customer value) to output human-readable strings and (optionally) raw numbers alongside.

## Edge cases to handle
- Amounts between 1,000 and 9,999: decide whether to say “$9.5 thousand” or “$9 thousand”. Default: one decimal for < 10 thousand, then no decimals above that (cleaner speech).
- Exactly round numbers: “$2.0 million” should become “$2 million”.
- Negative values (refunds): “-$12 thousand” (if relevant).
- Dates: use long-month format to avoid “slash” speech.

## Test plan (end-to-end)
1. Start a new Rari voice session.
2. Ask: “What’s today’s date?”
   - Expect: she answers with the injected current date (no “I don’t have access…”).
3. Ask: “What’s my total revenue this month?” and “Show me today’s revenue.”
   - Expect: “$1.2 million” / “$125 thousand”, not “$1200000”.
4. Ask: “What are my upcoming bookings?”
   - Expect: date ranges read naturally like “February 10–14, 2026”, not “2/10/2026 to 2/14/2026” and not random June dates.
5. Verify logs (optional):
   - `sendContextualUpdate` called once per session
   - tool responses returning formatted strings.

## Expected outcome
- Rari consistently knows the current date/time every session, without relying on ElevenLabs dashboard variable wiring.
- Rari speaks money and large metrics in a human way (thousand/million/billion) across bookings, revenue, customer lifetime value, and other “report” outputs.
