// Uptime monitor: fetches the published app URL, checks for the React root shell,
// HEAD-checks referenced JS/CSS bundles, records the result and emails on state change.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_URL = Deno.env.get("UPTIME_TARGET_URL") ?? "https://app.exotiq.ai";
const ALERT_TO = "hello@exotiq.ai";
const FROM = "Exotiq Uptime <noreply@exotiq.ai>";
const TIMEOUT_MS = 15_000;

type CheckResult = {
  status: "up" | "down";
  http_status: number | null;
  latency_ms: number;
  failure_reason: string | null;
};

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

async function runCheck(): Promise<CheckResult> {
  const start = Date.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(TARGET_URL, { headers: { "User-Agent": "ExotiqUptimeBot/1.0" } });
  } catch (e) {
    return {
      status: "down",
      http_status: null,
      latency_ms: Date.now() - start,
      failure_reason: `Network error: ${(e as Error).message}`,
    };
  }
  const latency_ms = Date.now() - start;

  if (!res.ok) {
    return { status: "down", http_status: res.status, latency_ms, failure_reason: `HTTP ${res.status}` };
  }

  const html = await res.text();
  if (!/<div\s+id=["']root["']/i.test(html)) {
    return { status: "down", http_status: res.status, latency_ms, failure_reason: "Missing <div id=\"root\"> in HTML shell" };
  }

  // Extract referenced JS/CSS asset URLs and HEAD-check them. Catches broken bundle deploys.
  const assetUrls = new Set<string>();
  const re = /(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      assetUrls.add(new URL(m[1], TARGET_URL).toString());
    } catch { /* ignore */ }
  }

  const checks = await Promise.all(
    [...assetUrls].slice(0, 20).map(async (u) => {
      try {
        const r = await fetchWithTimeout(u, { method: "HEAD" }, 10_000);
        return r.ok ? null : `Asset ${r.status}: ${u}`;
      } catch (e) {
        return `Asset error: ${u} (${(e as Error).message})`;
      }
    }),
  );
  const assetFailure = checks.find((c) => c !== null) as string | undefined;
  if (assetFailure) {
    return { status: "down", http_status: res.status, latency_ms, failure_reason: assetFailure };
  }

  return { status: "up", http_status: res.status, latency_ms, failure_reason: null };
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}m`;
}

function downEmail(result: CheckResult): { subject: string; html: string } {
  return {
    subject: `🔴 ${TARGET_URL} is DOWN`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h2 style="color:#b91c1c;margin:0 0 12px">App is DOWN</h2>
  <p style="margin:0 0 16px;color:#444">Uptime check failed for <a href="${TARGET_URL}">${TARGET_URL}</a>.</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <tr><td style="padding:6px 0;color:#666">Reason</td><td style="padding:6px 0"><b>${result.failure_reason ?? "Unknown"}</b></td></tr>
    <tr><td style="padding:6px 0;color:#666">HTTP status</td><td style="padding:6px 0">${result.http_status ?? "—"}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Latency</td><td style="padding:6px 0">${result.latency_ms} ms</td></tr>
    <tr><td style="padding:6px 0;color:#666">Time</td><td style="padding:6px 0">${new Date().toISOString()}</td></tr>
  </table>
  <p style="margin-top:24px;color:#666;font-size:12px">You'll get another email when the app comes back up.</p>
</div>`,
  };
}

function upEmail(downSinceMs: number): { subject: string; html: string } {
  return {
    subject: `🟢 ${TARGET_URL} is back UP`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h2 style="color:#15803d;margin:0 0 12px">App is back UP</h2>
  <p style="margin:0 0 16px;color:#444"><a href="${TARGET_URL}">${TARGET_URL}</a> is responding normally again.</p>
  <p style="margin:0 0 8px"><b>Downtime: ${formatDuration(downSinceMs)}</b></p>
  <p style="margin-top:24px;color:#666;font-size:12px">Automated uptime monitor.</p>
</div>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const result = await runCheck();

  // Get last status to detect state change.
  const { data: prev } = await supabase
    .from("uptime_checks")
    .select("status, checked_at")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // For up-recovery, find when the down streak started.
  let downSinceMs = 0;
  if (prev?.status === "down" && result.status === "up") {
    const { data: firstDown } = await supabase
      .from("uptime_checks")
      .select("checked_at")
      .eq("status", "up")
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const since = firstDown?.checked_at ?? prev.checked_at;
    downSinceMs = Date.now() - new Date(since).getTime();
  }

  // Insert this check.
  const { error: insertErr } = await supabase.from("uptime_checks").insert({
    status: result.status,
    http_status: result.http_status,
    latency_ms: result.latency_ms,
    failure_reason: result.failure_reason,
    target_url: TARGET_URL,
  });
  if (insertErr) console.error("[uptime-check] insert error:", insertErr);

  // Email only on state change (or first-ever check that's down).
  const stateChanged = !prev || prev.status !== result.status;
  if (stateChanged) {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resend = new Resend(resendKey);
      const mail = result.status === "down" ? downEmail(result) : upEmail(downSinceMs);
      // Only send "up" email if we previously sent a "down" (skip first-ever check if it's up).
      if (result.status === "down" || prev?.status === "down") {
        const { error: mailErr } = await resend.emails.send({
          from: FROM,
          to: [ALERT_TO],
          subject: mail.subject,
          html: mail.html,
        });
        if (mailErr) console.error("[uptime-check] email error:", mailErr);
      }
    } else {
      console.error("[uptime-check] RESEND_API_KEY missing, skipping alert email");
    }
  }

  return new Response(JSON.stringify({ ok: true, result, stateChanged }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
