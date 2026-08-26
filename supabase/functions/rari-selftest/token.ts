// @ts-nocheck
// Server-side minting of scoped Rari tool tokens for the self-test harness.
//
// Test tokens are minted HERE, inside a super-admin-gated edge function, so no
// tenant user credential ever leaves the platform or lands in a script env.
// The shape is identical to what `elevenlabs-session` mints, so the harness
// exercises the real auth path rather than a test-only bypass.

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function strToBase64Url(str: string): string {
  return toBase64Url(new TextEncoder().encode(str));
}

/** Mint a short-lived (10 min) tool token scoped to one user + team. */
export async function mintTestToolToken(
  userId: string,
  teamId: string | null,
  secret: string,
  ttlSeconds = 600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = strToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = strToBase64Url(
    JSON.stringify({ userId, teamId, iat: now, exp: now + ttlSeconds }),
  );
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Deliberately expired token, for the auth-refusal assertions. */
export async function mintExpiredToolToken(
  userId: string,
  teamId: string | null,
  secret: string,
): Promise<string> {
  return mintTestToolToken(userId, teamId, secret, -60);
}
