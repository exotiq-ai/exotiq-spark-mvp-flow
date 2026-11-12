// Build guard (opt-in): when EXPECTED_SUPABASE_REF is set, refuse to build unless the Supabase settings come
// from the real environment (not the committed .env) and point at that exact project.
// Prevents a Netlify site from silently falling back to the committed .env (which names the old project).
const expected = process.env.EXPECTED_SUPABASE_REF;
if (!expected) process.exit(0); // not enforced for builds that do not opt in

const fail = (msg) => { console.error(`\n[supabase-env guard] BUILD BLOCKED: ${msg}\n`); process.exit(1); };
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url) fail('VITE_SUPABASE_URL is not set in the build environment (the committed .env would be used instead).');
if (!key) fail('VITE_SUPABASE_PUBLISHABLE_KEY is not set in the build environment.');
let host;
try { host = new URL(url).hostname; } catch { fail('VITE_SUPABASE_URL is not a valid URL.'); }
if (host !== `${expected}.supabase.co`) fail(`VITE_SUPABASE_URL points at ${host}, expected ${expected}.supabase.co.`);
try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
  if (payload.ref && payload.ref !== expected) fail(`the publishable key belongs to project ${payload.ref}, expected ${expected}.`);
} catch { /* newer sb_publishable_ keys are not JWTs; the URL check above still applies */ }
if (process.env.VITE_SUPABASE_PROJECT_ID && process.env.VITE_SUPABASE_PROJECT_ID !== expected)
  fail(`VITE_SUPABASE_PROJECT_ID is ${process.env.VITE_SUPABASE_PROJECT_ID}, expected ${expected}.`);
console.log(`[supabase-env guard] OK: building against project ${expected}.`);
