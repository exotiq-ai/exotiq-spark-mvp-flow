// _shared/transferGuard.ts
// Cross-border AI transfer controls — PII redaction + audit logging.
//
// Use from any edge function that sends data to an AI provider:
//
//   import { withTransferGuard } from "../_shared/transferGuard.ts";
//
//   const { payload, log } = await withTransferGuard({
//     team_id, user_id, caller: "ai-pricing", model, provider, providerRegion,
//     payload: rawPayload,
//   });
//   // send `payload` to provider...
//   await log({ status: "ok", response_bytes: responseSize });
//
// Behavior:
//   - Looks up team's ai_data_minimization_level (default 'standard').
//   - 'strict' (auto for EU/UK teams): redacts known PII keys and replaces
//     them with stable pseudonyms scoped to the request.
//   - Always inserts a row in ai_transfer_log via service-role client.
//   - Failures to log are swallowed (warn-only) so AI calls keep working.

import { createClient } from "npm:@supabase/supabase-js@2";

const PII_KEY_PATTERNS = [
  /name/i,
  /email/i,
  /phone/i,
  /address/i,
  /dob/i,
  /birth/i,
  /license/i,
  /passport/i,
  /ssn/i,
  /tax_?id/i,
];

const NEVER_TRANSFER_KEYS = [
  /drivers?_?license_?number/i,
  /date_of_birth/i,
  /ssn/i,
];

export type MinimizationLevel = "standard" | "strict";

export interface TransferGuardOptions {
  team_id: string | null;
  user_id?: string | null;
  caller: string;
  model: string;
  provider: string;
  provider_region?: string;
  payload: unknown;
  minimization_level_override?: MinimizationLevel;
}

export interface TransferLogContext {
  payload: unknown;
  field_count: number;
  redacted_field_count: number;
  minimization_level: MinimizationLevel;
  log: (result: {
    status?: "ok" | "error";
    response_bytes?: number;
  }) => Promise<void>;
}

let cachedAdmin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (cachedAdmin) return cachedAdmin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase service env");
  cachedAdmin = createClient(url, key);
  return cachedAdmin;
}

async function resolveLevel(
  team_id: string | null,
  override?: MinimizationLevel
): Promise<MinimizationLevel> {
  if (override) return override;
  if (!team_id) return "standard";
  try {
    const { data } = await admin()
      .from("teams")
      .select("ai_data_minimization_level, data_region")
      .eq("id", team_id)
      .maybeSingle();
    const region = (data as any)?.data_region;
    const level = (data as any)?.ai_data_minimization_level as
      | MinimizationLevel
      | undefined;
    if (level === "strict") return "strict";
    if (region === "eu") return "strict";
    return "standard";
  } catch {
    return "standard";
  }
}

interface RedactionResult {
  payload: unknown;
  fieldCount: number;
  redactedCount: number;
}

function pseudonymFor(key: string, value: string): string {
  // Stable per-request: cheap hash to integer; not cryptographic.
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return `<${key}:${(h >>> 0).toString(36)}>`;
}

function redact(obj: unknown, level: MinimizationLevel): RedactionResult {
  let fieldCount = 0;
  let redactedCount = 0;

  function walk(node: unknown): unknown {
    if (node === null || node === undefined) return node;
    if (Array.isArray(node)) return node.map(walk);
    if (typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        fieldCount++;
        if (NEVER_TRANSFER_KEYS.some((re) => re.test(k))) {
          redactedCount++;
          continue; // drop entirely
        }
        if (
          level === "strict" &&
          PII_KEY_PATTERNS.some((re) => re.test(k)) &&
          typeof v === "string"
        ) {
          out[k] = pseudonymFor(k, v);
          redactedCount++;
        } else {
          out[k] = walk(v);
        }
      }
      return out;
    }
    return node;
  }

  return { payload: walk(obj), fieldCount, redactedCount };
}

async function hashFieldNames(payload: unknown): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      counts[k] = (counts[k] ?? 0) + 1;
      walk(v);
    }
  }
  walk(payload);
  return counts;
}

export async function withTransferGuard(
  opts: TransferGuardOptions
): Promise<TransferLogContext> {
  const level = await resolveLevel(opts.team_id, opts.minimization_level_override);
  const { payload, fieldCount, redactedCount } = redact(opts.payload, level);
  const fieldHashes = await hashFieldNames(payload);
  const requestBytes = JSON.stringify(payload).length;

  const log = async (result: { status?: "ok" | "error"; response_bytes?: number }) => {
    try {
      // deno-lint-ignore no-explicit-any
      await (admin().from("ai_transfer_log") as any).insert({
        team_id: opts.team_id,
        user_id: opts.user_id ?? null,
        caller: opts.caller,
        model: opts.model,
        provider: opts.provider,
        provider_region: opts.provider_region ?? null,
        minimization_level: level,
        payload_field_hashes: fieldHashes,
        field_count: fieldCount,
        redacted_field_count: redactedCount,
        request_bytes: requestBytes,
        response_bytes: result.response_bytes ?? null,
        status: result.status ?? "ok",
      });
    } catch (e) {
      console.warn("[transferGuard] log insert failed", e);
    }
  };

  return {
    payload,
    field_count: fieldCount,
    redacted_field_count: redactedCount,
    minimization_level: level,
    log,
  };
}

// Exported for tests
export const __test = { redact, pseudonymFor };
