import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logTransfer } from "../_shared/transferGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BriefCounts {
  onRent?: number;
  pickupsToday?: number;
  returnsToday?: number;
  overdueReturns?: number;
  newBookings24h?: number;
  pendingConfirmations?: number;
  openTasks?: number;
  overdueTasks?: number;
  utilization?: number;
}

interface BriefPayload {
  role?: string | null;
  counts?: BriefCounts;
  issueTitles?: string[];
}

// PII guards — strip anything that smells like a name/email/phone/address/license number.
const PII_PATTERNS = [
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/i, // email
  /\b\+?\d[\d\s().-]{7,}\b/, // phone-ish
  /\b\d{4,}\b/, // long digit runs (license, account)
];

const looksLikePII = (s: string) => PII_PATTERNS.some((re) => re.test(s));

const sanitizeTitles = (titles: string[] | undefined): string[] => {
  if (!Array.isArray(titles)) return [];
  return titles
    .filter((t) => typeof t === "string")
    .map((t) => t.replace(/\(([^)]+)\)/g, "").trim()) // drop parenthetical names
    .filter((t) => t.length > 0 && t.length <= 140 && !looksLikePII(t))
    .slice(0, 8);
};

const sanitizeCounts = (c: BriefCounts | undefined): BriefCounts => {
  if (!c || typeof c !== "object") return {};
  const out: BriefCounts = {};
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      (out as Record<string, number>)[k] = Math.max(0, Math.min(1_000_000, Math.round(v)));
    }
  }
  return out;
};

const deterministicNarrative = (counts: BriefCounts, role: string | null | undefined) => {
  const parts: string[] = [];
  if ((counts.overdueReturns ?? 0) > 0) {
    parts.push(
      `${counts.overdueReturns} overdue ${counts.overdueReturns === 1 ? "return" : "returns"} to chase`,
    );
  }
  if ((counts.pickupsToday ?? 0) > 0) {
    parts.push(`${counts.pickupsToday} going out today`);
  }
  if ((counts.returnsToday ?? 0) > 0) {
    parts.push(`${counts.returnsToday} coming back today`);
  }
  if ((counts.pendingConfirmations ?? 0) > 0) {
    parts.push(
      `${counts.pendingConfirmations} ${counts.pendingConfirmations === 1 ? "booking" : "bookings"} awaiting confirmation`,
    );
  }
  if ((counts.overdueTasks ?? 0) > 0) {
    parts.push(`${counts.overdueTasks} overdue ${counts.overdueTasks === 1 ? "task" : "tasks"}`);
  }

  const focus = role === "operator"
    ? "Focus on the punch list."
    : role === "viewer"
    ? "Here's where the fleet stands."
    : "Here's where to spend your morning.";

  if (parts.length === 0) {
    return `${focus} ${counts.onRent ?? 0} vehicles on rent · ${counts.utilization ?? 0}% utilization. Nothing urgent flagged.`;
  }
  return `${focus} ${parts.slice(0, 3).join(", ")}. Utilization ${counts.utilization ?? 0}%.`;
};

const deterministicActions = (counts: BriefCounts): string[] => {
  const a: string[] = [];
  if ((counts.overdueReturns ?? 0) > 0) a.push("Call overdue renters");
  if ((counts.pendingConfirmations ?? 0) > 0) a.push("Confirm pending bookings");
  if ((counts.overdueTasks ?? 0) > 0) a.push("Clear overdue fleet tasks");
  if (a.length === 0 && (counts.pickupsToday ?? 0) > 0) a.push("Prep today's pickups");
  return a.slice(0, 3);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = (await req.json().catch(() => ({}))) as BriefPayload;
    const role = typeof raw.role === "string" ? raw.role : null;
    const counts = sanitizeCounts(raw.counts);
    const issueTitles = sanitizeTitles(raw.issueTitles);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Deterministic fallback (used when no API key, on AI failure, or on any error).
    const fallback = {
      narrative: deterministicNarrative(counts, role),
      topActions: deterministicActions(counts),
    };

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tone =
      role === "owner" || role === "admin"
        ? "executive and strategic"
        : role === "manager"
        ? "operationally focused"
        : role === "operator"
        ? "task-oriented and direct"
        : "calm and informational";

    const userPrompt = `You are FleetCopilot, narrating a luxury car-rental operator's morning brief.
Tone: ${tone}.

ONLY use these aggregate counts — do NOT invent numbers, vehicles, customers, or events:
${JSON.stringify(counts)}

Top issue titles (already sanitized, no PII):
${issueTitles.map((t) => `- ${t}`).join("\n") || "- (none)"}

Write a 2–4 sentence punch list narrative the operator should read first thing. End with one practical action.
Return STRICT JSON: {"narrative": string, "topActions": string[] }`;

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are FleetCopilot. You ONLY rephrase the numbers given to you; you never invent figures, names, vehicles, customers, or events. Output strictly the JSON requested.",
            },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const content: string | undefined = aiData?.choices?.[0]?.message?.content?.trim();

      logTransfer({
        team_id: null,
        user_id: null,
        caller: "daily-brief-narrative",
        model: "google/gemini-3-flash-preview",
        provider: "Google (Gemini via Lovable AI Gateway)",
        provider_region: "United States / Global",
        response_bytes: content ? content.length : 0,
        status: "ok",
      }).catch(() => {});

      if (!content) {
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse model JSON; if malformed, return fallback.
      let parsed: { narrative?: unknown; topActions?: unknown } = {};
      try {
        const jsonStart = content.indexOf("{");
        const jsonEnd = content.lastIndexOf("}");
        parsed = JSON.parse(jsonStart >= 0 ? content.slice(jsonStart, jsonEnd + 1) : content);
      } catch {
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const narrative = typeof parsed.narrative === "string" && parsed.narrative.length <= 800
        ? parsed.narrative
        : fallback.narrative;
      const topActions = Array.isArray(parsed.topActions)
        ? parsed.topActions.filter((s) => typeof s === "string" && s.length <= 120).slice(0, 3)
        : fallback.topActions;

      return new Response(JSON.stringify({ narrative, topActions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (_err) {
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("daily-brief-narrative error:", error);
    return new Response(
      JSON.stringify({ narrative: "", topActions: [], error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
