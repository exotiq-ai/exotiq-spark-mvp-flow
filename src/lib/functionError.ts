/**
 * Turn a `supabase.functions.invoke` error into something an operator can act on.
 *
 * Two failure shapes get flattened into a generic string by the client SDK:
 *  - FunctionsHttpError: the function returned a non-2xx status. The JSON body
 *    (usually `{ error: "..." }`) holds the real reason, but `error.message` is
 *    always "Edge Function returned a non-2xx status code".
 *  - FunctionsFetchError: the request never reached the function (network drop,
 *    blocked request, gateway rejection before CORS headers). `error.message` is
 *    "Failed to send a request to the Edge Function", which reads like a bug in
 *    the button rather than a connectivity problem.
 */
export async function describeFunctionError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): Promise<string> {
  if (!error) return fallback;

  const anyErr = error as { message?: string; name?: string; context?: unknown };
  const res = anyErr?.context as { json?: () => Promise<unknown>; status?: number } | undefined;

  if (res && typeof res.json === "function") {
    try {
      const body = (await res.json()) as { error?: unknown; message?: unknown } | null;
      const detail = body?.error ?? body?.message;
      if (typeof detail === "string" && detail.trim()) return detail;
      if (detail && typeof detail === "object") return JSON.stringify(detail);
    } catch {
      // body wasn't JSON — fall through to the transport message
    }
  }

  const message = typeof anyErr?.message === "string" ? anyErr.message : "";

  if (anyErr?.name === "FunctionsFetchError" || /failed to send a request/i.test(message)) {
    return "Couldn't reach the server. Check your connection and try again — if it keeps happening, the request is being blocked.";
  }

  if (/non-2xx/i.test(message)) return fallback;

  return message || fallback;
}
