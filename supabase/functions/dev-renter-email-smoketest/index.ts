// One-off smoketest: invokes send-renter-email with sample paymentApproved variables.
// Delete after use.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendRenterEmail } from "../_shared/rentEmail.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const to = typeof body.to === "string" ? body.to : "gregory.ringler@gmail.com";
    const result = await sendRenterEmail({
      templateName: "paymentApproved",
      to,
      subject: "SMOKE TEST — You're approved — complete your Audi S8 booking",
      variables: {
        BOOKING_REF: "BK-SMOKE",
        OPERATOR_NAME: "Exotiq Test Operator",
        VEHICLE_NAME: "2023 Audi S8 Plus",
        VEHICLE_SHORT: "Audi S8",
        DATE_RANGE: "Sep 1 – 3",
        PICKUP_TIME: "5:00 PM EDT",
        LOCATION: "Miami, FL",
        RENTAL_AMOUNT: "$1,200.00",
        EXOTIQ_AMOUNT: "$180.00",
        TOTAL_DUE: "$1,380.00",
        PAYMENT_DEADLINE: "Aug 30, 5:00 PM EDT",
        PAY_URL: "https://book.exotiq.rent/booking/BK-SMOKE?t=smoke",
      },
      idempotencyKey: `smoke-${Date.now()}`,
    });
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
