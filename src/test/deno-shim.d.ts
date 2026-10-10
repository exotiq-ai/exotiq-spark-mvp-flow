// The edge-function modules in supabase/functions/_shared read configuration through Deno's global at call time.
// The app typechecks the tests that import them, so declare just the part they use. Not shipped to the browser.
declare const Deno: { env: { get(key: string): string | undefined } };
