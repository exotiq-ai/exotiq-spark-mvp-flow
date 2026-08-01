# Rari Agent Config Update — Apply in ElevenLabs Dashboard

The edge function (`elevenlabs-tools`) is already fixed and deployed. To make Rari **use** the fixes, paste the two blocks below into the ElevenLabs dashboard.

---

## 1. System Prompt — append this section

Open your Rari agent → **Agent → System Prompt** → scroll to the bottom and paste:

```
## Booking Status Vocabulary (IMPORTANT)

The database uses exactly four booking statuses:
- confirmed  — booked and approved
- pending    — awaiting approval
- completed  — finished
- cancelled  — cancelled

There is NO "active" status. When a user asks about cars that are "out", "active",
"currently rented", "on rent", or "rented right now", do NOT pass status:"active".
Instead call:

    get_bookings({ date: "today" })

The tool will return every booking overlapping today (status confirmed or pending).

Date shortcuts you should prefer over manual ranges:
- date: "today"      → bookings overlapping today
- date: "tomorrow"   → bookings overlapping tomorrow
- date: "this_week"  → bookings overlapping the next 7 days
- date: "upcoming"   → bookings starting today or later

For arbitrary windows, pass start_date and end_date (YYYY-MM-DD). The tool uses
overlap semantics — any booking that touches the window is returned, even if it
started before or ends after.

Every get_bookings response includes an `interpretation` field
(e.g. "Showing 20 bookings overlapping 2026-06-12, statuses: confirmed, pending").
Read it before you speak so your answer matches the data window the tool used.
Never invent counts; always cite the number returned.
```

---

## 2. Replace the `get_bookings` tool schema

Open **Agent → Tools → get_bookings → Edit** and replace the JSON with:

```json
{
  "type": "function",
  "name": "get_bookings",
  "description": "Get bookings, optionally filtered by status, date window, or location. Use date='today' for 'what's out / active / currently rented'. Date ranges use overlap semantics (any booking touching the window is returned).",
  "parameters": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "enum": ["today", "tomorrow", "this_week", "upcoming"],
        "description": "Preset window. 'today' returns bookings overlapping today (use this for 'active', 'out', 'currently rented'). 'upcoming' returns bookings starting today or later."
      },
      "status": {
        "type": "string",
        "enum": [
          "confirmed", "pending", "completed", "cancelled",
          "active", "current", "rented", "out", "upcoming", "today"
        ],
        "description": "Canonical: confirmed | pending | completed | cancelled. Synonyms 'active' | 'current' | 'rented' | 'out' resolve to confirmed+pending overlapping today. 'upcoming' resolves to confirmed+pending starting today or later. 'today' returns any status overlapping today."
      },
      "start_date": {
        "type": "string",
        "description": "YYYY-MM-DD. Combined with end_date returns any booking overlapping the window."
      },
      "end_date": {
        "type": "string",
        "description": "YYYY-MM-DD. Combined with start_date returns any booking overlapping the window."
      },
      "location": {
        "type": "string",
        "enum": ["Miami", "Scottsdale", "all"],
        "description": "Filter by vehicle location."
      }
    }
  }
}
```

Webhook URL (unchanged):
```
https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools
```

---

## 3. Test in the dashboard sandbox

Click **Test agent** and run these three prompts:

| Prompt | Expected |
|---|---|
| "What's out today?" | ~20 bookings, real customer/vehicle names, interpretation cites today's date |
| "Show me active rentals" | Same ~20 (synonym path) |
| "Any bookings between June 12 and June 14?" | Includes bookings that started before Jun 12 and end after — overlap is working |

If all three pass, **Publish** the agent. Done.

---

## 4. Future: full API control

If you provide a Workspace-Admin ElevenLabs API key (stored as `ELEVENLABS_ADMIN_API_KEY`), I can manage all of the above programmatically via the Conversational AI REST API:

- `PATCH /v1/convai/agents/:agent_id` — system prompt, voice, model
- `POST/PATCH/DELETE /v1/convai/agents/:agent_id/tools` — tool CRUD
- `GET /v1/convai/conversations` — pull transcripts for debugging

Recommended pattern: check a `rari-agent.config.json` into the repo as source of truth, with a sync script that pushes diffs to ElevenLabs — no more dashboard clicking. Just say the word and I'll scaffold it.
