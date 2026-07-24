// M6d shared helper: call send-renter-email from other edge functions.
// Internal-only; relies on INTERNAL_FUNCTION_TOKEN for auth.

export type RenterTemplateName =
  | "paymentApproved"
  | "paymentReminder"
  | "receiptConfirmed"
  | "refundConfirmation"
  | "paymentExpired"
  | "operatorExpired";

export interface SendRenterEmailArgs {
  templateName: RenterTemplateName;
  to: string;
  subject: string;
  variables: Record<string, string | number | undefined>;
  idempotencyKey: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  bcc?: string | string[];
}

export async function sendRenterEmail(
  args: SendRenterEmailArgs,
): Promise<{ message_id?: string | null }> {
  const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!internalToken || !supabaseUrl) {
    throw new Error("Missing INTERNAL_FUNCTION_TOKEN or SUPABASE_URL");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/send-renter-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": internalToken,
    },
    body: JSON.stringify(args),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `send-renter-email failed: ${res.status} ${JSON.stringify(json)}`,
    );
  }
  return json as { message_id?: string | null };
}
