// DEPRECATED 2026-07-28.
//
// Exotiq exited the security-deposit flow entirely. Renters now settle the
// deposit with the operator at pickup by whatever method the operator accepts
// (card, cash, operator's own terminal). This function no longer has a
// legitimate caller — the DepositPanel "Request deposit card" button has been
// removed and no scheduler invokes it. We keep the deployed endpoint alive so
// stale clients get a clear 410 instead of function-not-found.
//
// Do not re-enable without revisiting the 2026-07-28 decision.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "deposit_flow_removed",
      message:
        "Exotiq no longer collects or mediates the security deposit. Renters settle the deposit directly with the operator at pickup.",
      decided_at: "2026-07-28",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
