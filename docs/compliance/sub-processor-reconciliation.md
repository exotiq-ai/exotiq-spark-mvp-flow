# Sub-Processor Registry Reconciliation

**Run date:** June 14, 2026
**Scope:** every outbound vendor SDK / HTTP call detected in `supabase/functions/**` and `src/**` compared against `src/lib/compliance/subProcessors.ts` + `public.sub_processors`.

## Findings

| Vendor | Detected in code | In registry before this pass | Action |
|---|---|---|---|
| Lovable Cloud (Supabase) | everywhere | ✅ active | none |
| Stripe | `stripe-*` edge functions, Settings | ✅ active | none |
| Google Gemini (via Lovable AI Gateway) | `ai-pricing`, `ai-demand-forecast`, `identify-vehicle`, `parse-expense-receipt`, etc. | ✅ active | none |
| OpenAI | `rari-*` paths | ✅ active | none |
| Anthropic | `rari-*` paths | ✅ active | none |
| ElevenLabs | `rari-agent-admin`, `rari-mcp-server`, voice agent | ✅ active | none |
| Google Calendar API | `googleCalendar.ts` | ✅ active | none |
| MotorIQ | external sync | ✅ active | none |
| **Resend** | `role-change-notification`, `rari-email-summary`, `mention-notification`, `resend-invite`, `invite-user`, `send-signed-document` | ❌ missing | **added** |
| **GoHighLevel** | referenced in `Privacy.tsx`, `Sms.tsx`, `DataProcessing.tsx`; primary SMS sender | ❌ missing | **added** |
| **Twilio** | referenced in `Privacy.tsx`, `Sms.tsx`, `DataProcessing.tsx`; downstream of GHL | ❌ missing | **added** |

## Vendors mentioned in legal text but not yet integrated

These appear in `Terms.tsx` / `Privacy.tsx` as forward-looking categories. Do **not** add to the active registry until a real integration ships:

- Telematics providers (Smartcar / Geotab / Samsara) — referenced as "telematics-derived data" in counsel-drafted EU/UK notice. No code path detected.
- Insurance partners — referenced in `Terms.tsx`. No code path detected.

## Things that match cleanly

- `transferGuard.ts` provider strings (`provider: "Google (Gemini via Lovable AI Gateway)"`, `provider: "OpenAI"`, etc.) now align 1:1 with the registry.
- `data_processing_inventory.sub_processor_names` arrays in `dataInventory.ts` already list Resend-adjacent flows under the right `entity` (e.g. invite emails reference profiles.email).

## Outstanding

- **GoHighLevel does not publish a public DPA URL.** Operations should request a counter-signed DPA before EU/UK customers go live; registry currently has `dpa_url = NULL`.
- **Telematics + insurance** stay off the registry until integrated. When added, this doc is the audit trail for why they were absent prior.
