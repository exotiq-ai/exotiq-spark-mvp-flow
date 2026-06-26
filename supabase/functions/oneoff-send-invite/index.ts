import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

serve(async () => {
  const token = "4a834d6076c257e06dcd6af27fccc18d49861aa1b5f65fa6";
  const link = `https://app.exotiq.ai/auth?invite=${token}`;
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#111">
    <h2 style="margin:0 0 16px">You've been invited to J Davidson's Fleet</h2>
    <p>Hi Chantara,</p>
    <p>J Davidson has invited you to join <strong>J Davidson's Fleet</strong> on Exotiq as a <strong>Manager</strong>.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Accept Invitation</a>
    </p>
    <p style="color:#666;font-size:13px">Or paste this link into your browser:<br><a href="${link}">${link}</a></p>
    <p style="color:#666;font-size:13px">Note: <strong>chantaralynn@gmail.com</strong> is already active on this fleet as a manager — either email will work going forward.</p>
    <p style="color:#999;font-size:12px;margin-top:32px">This invitation expires in 7 days.</p>
  </div>`;

  const r = await resend.emails.send({
    from: "Exotiq <noreply@mail.exotiq.ai>",
    to: ["echantara@gmail.com"],
    subject: "You've been invited to J Davidson's Fleet on Exotiq",
    html,
  });
  return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
});
