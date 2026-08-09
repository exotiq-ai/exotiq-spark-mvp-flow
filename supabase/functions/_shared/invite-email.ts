/**
 * Shared exotiq-branded invite email.
 * Used by invite-user, resend-invite and super-admin-send-invite so every
 * invitation looks identical. Clean, minimal, logo-mark led.
 */

const LOGO_URL = "https://app.exotiq.ai/brand/logos/exotiq-mark-black.png";
const APP_URL = "https://app.exotiq.ai";

export interface InviteEmailParams {
  companyName: string;
  inviterName?: string | null;
  role: string;
  inviteLink: string;
  /** Renders reminder-flavoured copy */
  reminder?: boolean;
  /** Days until the link expires */
  expiresInDays?: number;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const article = (role: string) => (/^[aeiou]/i.test(role) ? "an" : "a");

export function buildInviteEmail(params: InviteEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    companyName,
    inviterName,
    role,
    inviteLink,
    reminder = false,
    expiresInDays = 7,
  } = params;

  const company = escapeHtml(companyName || "your team");
  const inviter = escapeHtml((inviterName || "").trim());
  const roleLabel = escapeHtml(role || "team member");
  const link = inviteLink;

  const subject = reminder
    ? `Reminder: You've been invited to join ${companyName}`
    : `You've been invited to join ${companyName}`;

  const introLine = inviter
    ? `${inviter} invited you to join <strong>${company}</strong> as ${article(
        roleLabel
      )} ${roleLabel}.`
    : `You've been invited to join <strong>${company}</strong> as ${article(
        roleLabel
      )} ${roleLabel}.`;

  const reminderLine = reminder
    ? `<p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#5f6368;">A quick reminder — your invitation is still waiting.</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <tr>
              <td align="center" style="padding-bottom:36px;">
                <img src="${LOGO_URL}" alt="exotiq" width="28" height="28" style="display:inline-block; vertical-align:middle; border:0;" />
                <span style="display:inline-block; vertical-align:middle; margin-left:8px; font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#0a0a0a;">exotiq</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:8px;">
                <h1 style="margin:0; font-size:24px; line-height:1.3; font-weight:700; letter-spacing:-0.02em; color:#0a0a0a;">You've been invited to join ${company}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;">
                ${reminderLine}
                <p style="margin:0 0 28px; font-size:15px; line-height:1.6; color:#5f6368;">${introLine}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="${link}" style="display:inline-block; background-color:#0a0a0a; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:600;">Accept invitation</a>
              </td>
            </tr>
            <tr>
              <td>
                <p style="margin:0 0 8px; font-size:13px; line-height:1.6; color:#8a8f98;">This link expires in ${expiresInDays} days. If the button doesn't work, copy and paste this address into your browser:</p>
                <p style="margin:0; font-size:12px; line-height:1.6; color:#8a8f98; word-break:break-all;">${link}</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top:32px;">
                <hr style="border:none; border-top:1px solid #ececec; margin:0 0 16px;" />
                <p style="margin:0; font-size:12px; line-height:1.6; color:#a1a5ac;">exotiq &middot; <a href="${APP_URL}" style="color:#a1a5ac; text-decoration:none;">app.exotiq.ai</a><br />If you weren't expecting this invitation, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textIntro = inviterName
    ? `${inviterName} invited you to join ${companyName} as ${article(role)} ${role}.`
    : `You've been invited to join ${companyName} as ${article(role)} ${role}.`;

  const text = [
    "exotiq",
    "",
    `You've been invited to join ${companyName}`,
    "",
    reminder ? "A quick reminder — your invitation is still waiting." : "",
    textIntro,
    "",
    "Accept your invitation:",
    link,
    "",
    `This link expires in ${expiresInDays} days.`,
    "",
    "exotiq · app.exotiq.ai",
    "If you weren't expecting this invitation, you can safely ignore this email.",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  return { subject, html, text };
}
