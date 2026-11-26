/**
 * Who is told that someone accepted an invitation, and the email they get.
 *
 * Only the owners and admins of the team that was joined may learn the new
 * member's name and email. Platform `user_roles.admin` is NOT a signal: every
 * self-signup gets it, so using it told every admin of every team.
 */

export interface JoinTeamMemberRow {
  team_id: string | null;
  user_id: string | null;
  role: string | null;
  is_active: boolean | null;
}

export interface JoinRecipientInput {
  /** The invitation's team. */
  teamId: string | null | undefined;
  /** The invitation's `invited_by`. */
  invitedBy: string | null | undefined;
  /** The person who just joined; never told about themself. */
  newUserId: string;
  /** Rows from `team_members` (filtered again here, so extra rows are harmless). */
  teamMembers: JoinTeamMemberRow[];
}

const NOTIFIED_TEAM_ROLES = new Set(["owner", "admin"]);

/** User ids to notify, each once. */
export function selectJoinNotificationRecipients(input: JoinRecipientInput): string[] {
  const { teamId, invitedBy, newUserId, teamMembers } = input;

  if (!teamId) {
    return invitedBy && invitedBy !== newUserId ? [invitedBy] : [];
  }

  const ids = new Set<string>();
  for (const m of teamMembers) {
    if (m.team_id !== teamId) continue;
    if (m.is_active !== true) continue;
    if (!m.role || !NOTIFIED_TEAM_ROLES.has(m.role)) continue;
    if (!m.user_id || m.user_id === newUserId) continue;
    ids.add(m.user_id);
  }
  return [...ids];
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export interface TeamMemberJoinedEmailParams {
  recipientName: string | null | undefined;
  newUserName: string;
  newUserEmail: string;
  role: string;
  companyName: string | null | undefined;
}

export function buildTeamMemberJoinedEmail(params: TeamMemberJoinedEmailParams): {
  subject: string;
  html: string;
} {
  const recipient = (params.recipientName ?? "").trim();
  const newUserName = (params.newUserName ?? "").trim() || params.newUserEmail;
  const greeting = recipient ? `Hi ${escapeHtml(recipient)},` : "Hi there,";
  const company = escapeHtml((params.companyName ?? "").trim() || "your team");

  const subject = `New Team Member Joined: ${newUserName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Team Member Alert</h2>
      <p>${greeting}</p>
      <p>A new team member has joined ${company}:</p>
      <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Name:</strong> ${escapeHtml(newUserName)}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${escapeHtml(params.newUserEmail)}</p>
        <p style="margin: 4px 0;"><strong>Role:</strong> ${escapeHtml(params.role)}</p>
      </div>
      <p>You can view and manage team members in Settings → User Management.</p>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        This is an automated notification from Exotiq.
      </p>
    </div>
  `;
  return { subject, html };
}
