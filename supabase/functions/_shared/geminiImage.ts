// _shared/geminiImage.ts
// Calls Google's Gemini image model DIRECTLY (not through the Lovable AI Gateway) and returns a Response shaped like
// the gateway's chat-completions reply, so existing callers keep their parsing and error handling unchanged:
//   { choices: [ { message: { images: [ { image_url: { url: "data:image/png;base64,..." } } ] } } ] }
// Errors are passed through with Google's HTTP status (429 stays 429).
//
// Secrets: GEMINI_API_KEY (required). Optional GEMINI_IMAGE_MODEL (default below, the current GA image model per Google's Oct 2026 release notes).

// Gemini Developer API (keys start with "AIza", created in Google AI Studio). Override with GEMINI_BASE_URL if needed.
function baseFor(_key: string): string {
  return Deno.env.get("GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta";
}

export function geminiImageModel(): string {
  return Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-nano-banana-2.1";
}

function parseDataUrl(u: string): { mimeType: string; data: string } | null {
  const m = u.match(/^data:([^;]+);base64,([\s\S]*)$/);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function geminiImageResponse(
  opts: { prompt: string; sourceDataUrl?: string; model?: string },
): Promise<Response> {
  const key = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
  if (!key) return jsonResponse({ error: "GEMINI_API_KEY is not configured" }, 500);

  const parts: Array<Record<string, unknown>> = [{ text: opts.prompt }];
  if (opts.sourceDataUrl) {
    const img = parseDataUrl(opts.sourceDataUrl);
    if (!img) return jsonResponse({ error: "source image is not a base64 data URL" }, 400);
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  }

  const res = await fetch(`${baseFor(key)}/models/${opts.model || geminiImageModel()}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  if (!res.ok) {
    return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
  }

  const data = await res.json();
  const outParts: Array<Record<string, any>> = data?.candidates?.[0]?.content?.parts ?? [];
  const images = outParts
    .map((p) => p.inlineData ?? p.inline_data)
    .filter((x) => x && x.data)
    .map((x) => ({
      type: "image_url",
      image_url: { url: `data:${x.mimeType ?? x.mime_type ?? "image/png"};base64,${x.data}` },
    }));
  return jsonResponse(
    { choices: [{ message: { role: "assistant", content: "", images } }], usage: data?.usageMetadata ?? null },
    200,
  );
}
