// _shared/aiProvider.ts
// One place that decides which AI provider the text/vision edge functions talk to.
// Replaces the Lovable AI Gateway (which only works inside Lovable Cloud) with any OpenAI-compatible
// chat-completions endpoint. Image generation is NOT handled here (see _shared/geminiImage.ts).
//
// Secrets / settings (set with `supabase secrets set`):
//   OPENAI_API_KEY    required
//   AI_MODEL_TEXT     required  model id for text, JSON and tool-calling work
//   AI_MODEL_VISION   optional  model id for calls that include images (falls back to AI_MODEL_TEXT)
//   AI_BASE_URL       optional  defaults to https://api.openai.com/v1
//   AI_REASONING_EFFORT optional e.g. "none". Some models refuse tool calls unless this is "none".
//
// Model ids are deliberately NOT hard-coded: pick them from your provider's current model list.

export type AiTier = "text" | "vision";

export function aiBaseUrl(): string {
  return (Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");
}

export function aiChatUrl(): string {
  return `${aiBaseUrl()}/chat/completions`;
}

export function aiModel(tier: AiTier = "text"): string {
  const text = Deno.env.get("AI_MODEL_TEXT");
  const model = tier === "vision" ? (Deno.env.get("AI_MODEL_VISION") || text) : text;
  if (!model) {
    throw new Error(
      `AI_MODEL_${tier === "vision" ? "VISION or AI_MODEL_TEXT" : "TEXT"} is not configured (set it with 'supabase secrets set')`,
    );
  }
  return model;
}

// Label written to ai_transfer_log.provider so the audit trail names the real recipient.
export function aiProviderLabel(): string {
  const base = aiBaseUrl();
  return base.includes("api.openai.com") ? "OpenAI" : `OpenAI-compatible (${new URL(base).hostname})`;
}

// Spread into every chat-completions request body: model + optional reasoning_effort.
export function aiRequestParams(tier: AiTier = "text"): Record<string, unknown> {
  const params: Record<string, unknown> = { model: aiModel(tier) };
  const effort = Deno.env.get("AI_REASONING_EFFORT");
  if (effort) params.reasoning_effort = effort;
  return params;
}

// ---- Web search (OpenAI Responses API) -------------------------------------------------------
// Lets the model look things up on the live web instead of answering from memory. Used by the event engine.
// Set AI_EVENTS_WEB_SEARCH=off to disable. Returns null when disabled, unsupported or failed, so callers can fall back.
export function aiWebSearchEnabled(): boolean {
  return (Deno.env.get("AI_EVENTS_WEB_SEARCH") ?? "on").toLowerCase() !== "off";
}

export interface WebSearchOptions {
  /** Replaces the default output-format instruction (keys the model must return). */
  outputSpec?: string;
  /** Upper bound on web-search tool calls for this request. */
  maxCalls?: number;
}

export async function aiWebSearchJson(prompt: string, signal?: AbortSignal, opts: WebSearchOptions = {}): Promise<unknown[] | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(`${aiBaseUrl()}/responses`, {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel("text"),
        // Speed settings (measured: ~25-35 s instead of 60-100+ s). "minimal" effort is not allowed together with web_search.
        reasoning: { effort: Deno.env.get("AI_WEB_SEARCH_EFFORT") || "low" },
        max_tool_calls: opts.maxCalls ?? Number(Deno.env.get("AI_WEB_SEARCH_MAX_CALLS") || 3),
        tools: [{ type: "web_search", search_context_size: "low" }],
        input: prompt +
          "\n\nUse web search to confirm each event. " +
          (opts.outputSpec ??
            "Return ONLY a JSON array of objects with keys: name, date (YYYY-MM-DD), " +
            "endDate (YYYY-MM-DD), category, attendance (number), impactScore (0-100), description. No prose. Return [] if none are confirmed."),
      }),
    });
    if (!res.ok) {
      console.error("web search call failed:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const j = await res.json();
    const text: string = (j?.output ?? [])
      .filter((o: { type: string }) => o.type === "message")
      .flatMap((o: { content?: Array<{ text?: string }> }) => o.content ?? [])
      .map((c: { text?: string }) => c.text ?? "")
      .join("");
    const a = text.indexOf("["), b = text.lastIndexOf("]");
    if (a < 0 || b < a) return null;
    const arr = JSON.parse(text.slice(a, b + 1));
    return Array.isArray(arr) ? arr : null;
  } catch (e) {
    console.error("web search events failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
