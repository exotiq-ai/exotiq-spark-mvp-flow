/**
 * Whether the server can PREVIEW an extension without charging (the dry run in rent-extend-booking).
 *
 * Why this exists: an older version of rent-extend-booking ignores an unknown "dry_run" flag and carries the request out,
 * which for a booking with a card on file means a real charge on every preview. So the app first asks the server what it
 * supports, and only sends a preview when the server answered that it can. Anything else (an error, an old function,
 * a network failure) means "no preview", and the dialog shows its own local estimate instead.
 */
export type InvokeFn = (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;

let cached: Promise<boolean> | null = null;

export function supportsExtensionPreview(invoke: InvokeFn): Promise<boolean> {
  if (!cached) {
    cached = invoke("rent-extend-booking", { body: { probe: "capabilities" } })
      .then(({ data, error }) => !error && (data as { capabilities?: { dry_run?: boolean } } | null)?.capabilities?.dry_run === true)
      .catch(() => false);
  }
  return cached;
}

/** Forget the answer (used by tests, and after a deploy changes what the server supports). */
export function resetExtensionPreviewSupport() {
  cached = null;
}
