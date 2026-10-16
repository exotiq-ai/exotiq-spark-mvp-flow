// Shared origin allow-list for anything that ends up in an email, an SMS, or a
// third-party redirect (Stripe return URLs, invite links, etc.).
//
// Never trust `req.headers.get("origin")` for those links: whoever clicks
// "send invite" might be sitting on a build-preview domain, and the recipient
// would then get a link that lands them on the builder's access screen instead
// of the Exotiq app. Everything funnels through safeAppOrigin() so that can't
// happen again.

export const DEFAULT_APP_ORIGIN = "https://app.exotiq.ai";

/** Origins the operator-facing Command Center is actually served from. */
export const ALLOWED_APP_ORIGINS: readonly string[] = [
  "https://app.exotiq.ai",
  "https://exotiq.ai",
  "https://www.exotiq.ai",
];

function normalize(candidate: string): string {
  return candidate.trim().replace(/\/+$/, "");
}

/**
 * Returns a safe, Exotiq-owned origin for user-facing links.
 * Anything unknown (preview domains, localhost, spoofed origins) collapses to
 * the canonical app origin.
 */
/**
 * Extra https origins allowed in NON-production environments (staging/rehearsal), set as a comma-separated
 * list in the EXTRA_APP_ORIGINS secret. Unset in production, so production behaviour is unchanged.
 */
function extraAppOrigins(): string[] {
  return (Deno.env.get("EXTRA_APP_ORIGINS") ?? "")
    .split(",")
    .map(normalize)
    .filter((o) => o.startsWith("https://"));
}

export function safeAppOrigin(candidate?: string | null): string {
  if (!candidate) return DEFAULT_APP_ORIGIN;
  const normalized = normalize(candidate);
  if (!normalized.startsWith("https://")) return DEFAULT_APP_ORIGIN;
  return ALLOWED_APP_ORIGINS.includes(normalized) || extraAppOrigins().includes(normalized)
    ? normalized
    : DEFAULT_APP_ORIGIN;
}

/** Convenience helper: safe origin straight off an incoming request. */
export function safeAppOriginFromRequest(req: Request): string {
  return safeAppOrigin(req.headers.get("origin"));
}
