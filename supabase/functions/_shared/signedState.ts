// Signed, short-lived `state` values for OAuth redirects.
//
// The value that comes back on the redirect is only accepted when it was
// issued by one of our own functions (HMAC-SHA256 over the payload with a
// server-side secret) and has not expired.
//
//   const state = await signState({ team_id, user_id }, secret);      // issuing side
//   const payload = await verifyState<{ team_id: string; user_id: string }>(state, secret);  // callback side
//   if (!payload) -> reject

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): ArrayBuffer | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return buffer;
  } catch {
    return null;
  }
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signState(payload: Record<string, unknown>, secret: string, ttlSeconds = 900): Promise<string> {
  if (!secret) throw new Error("state signing secret is not configured");
  const body = toBase64Url(encoder.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

export async function verifyState<T extends Record<string, unknown>>(state: string | null, secret: string | undefined): Promise<T | null> {
  if (!state || !secret) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const signature = fromBase64Url(parts[1]);
  if (!signature) return null;
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), signature, encoder.encode(parts[0]));
  if (!valid) return null;
  const bodyBytes = fromBase64Url(parts[0]);
  if (!bodyBytes) return null;
  try {
    const payload = JSON.parse(decoder.decode(bodyBytes)) as T & { exp?: number };
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
