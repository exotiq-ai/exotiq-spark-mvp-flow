// Who is told that someone accepted an invitation, and what the email says.
// accept-invite used to email every platform admin of every team; only the
// joined team's owners and admins (or, with no team, the inviter) may be told.
import { describe, expect, test } from "vitest";
import {
  buildTeamMemberJoinedEmail,
  selectJoinNotificationRecipients,
} from "../../supabase/functions/_shared/teamJoinNotify";

const TEAM = "team-a";
const OTHER_TEAM = "team-b";
const NEW_USER = "new-user";
const INVITER = "inviter";

describe("selectJoinNotificationRecipients", () => {
  test("notifies only active owners and admins of the invitation's team", () => {
    const recipients = selectJoinNotificationRecipients({
      teamId: TEAM,
      invitedBy: INVITER,
      newUserId: NEW_USER,
      teamMembers: [
        { team_id: TEAM, user_id: "owner-1", role: "owner", is_active: true },
        { team_id: TEAM, user_id: "admin-1", role: "admin", is_active: true },
        { team_id: TEAM, user_id: "manager-1", role: "manager", is_active: true },
        { team_id: TEAM, user_id: "viewer-1", role: "viewer", is_active: true },
        { team_id: TEAM, user_id: "admin-gone", role: "admin", is_active: false },
        { team_id: OTHER_TEAM, user_id: "admin-elsewhere", role: "admin", is_active: true },
        { team_id: OTHER_TEAM, user_id: "owner-elsewhere", role: "owner", is_active: true },
      ],
    });
    expect(recipients.sort()).toEqual(["admin-1", "owner-1"]);
  });

  test("never notifies the new member about themself", () => {
    const recipients = selectJoinNotificationRecipients({
      teamId: TEAM,
      invitedBy: INVITER,
      newUserId: NEW_USER,
      teamMembers: [
        { team_id: TEAM, user_id: "owner-1", role: "owner", is_active: true },
        { team_id: TEAM, user_id: NEW_USER, role: "admin", is_active: true },
      ],
    });
    expect(recipients).toEqual(["owner-1"]);
  });

  test("lists each person once", () => {
    const recipients = selectJoinNotificationRecipients({
      teamId: TEAM,
      invitedBy: INVITER,
      newUserId: NEW_USER,
      teamMembers: [
        { team_id: TEAM, user_id: "owner-1", role: "owner", is_active: true },
        { team_id: TEAM, user_id: "owner-1", role: "admin", is_active: true },
      ],
    });
    expect(recipients).toEqual(["owner-1"]);
  });

  test("a team with no owner or admin left tells nobody (not the platform)", () => {
    const recipients = selectJoinNotificationRecipients({
      teamId: TEAM,
      invitedBy: INVITER,
      newUserId: NEW_USER,
      teamMembers: [{ team_id: TEAM, user_id: "viewer-1", role: "viewer", is_active: true }],
    });
    expect(recipients).toEqual([]);
  });

  test("with no team on the invitation, only the inviter is told", () => {
    const recipients = selectJoinNotificationRecipients({
      teamId: null,
      invitedBy: INVITER,
      newUserId: NEW_USER,
      teamMembers: [
        { team_id: OTHER_TEAM, user_id: "admin-elsewhere", role: "admin", is_active: true },
      ],
    });
    expect(recipients).toEqual([INVITER]);
  });

  test("with no team and no inviter (or the inviter is the new member), nobody is told", () => {
    expect(
      selectJoinNotificationRecipients({
        teamId: null,
        invitedBy: null,
        newUserId: NEW_USER,
        teamMembers: [],
      }),
    ).toEqual([]);
    expect(
      selectJoinNotificationRecipients({
        teamId: undefined,
        invitedBy: NEW_USER,
        newUserId: NEW_USER,
        teamMembers: [],
      }),
    ).toEqual([]);
  });
});

describe("buildTeamMemberJoinedEmail", () => {
  const base = {
    newUserName: "Sam Rivera",
    newUserEmail: "sam@example.com",
    role: "manager",
    companyName: "Acme Rentals",
  };

  test("greets the recipient by name", () => {
    const { html } = buildTeamMemberJoinedEmail({ ...base, recipientName: "Jordan Lee" });
    expect(html).toContain("Hi Jordan Lee,");
    expect(html).not.toMatch(/Hi admin/i);
  });

  test("trims the recipient's name (no 'Hi Name ,')", () => {
    const { html } = buildTeamMemberJoinedEmail({ ...base, recipientName: "  Jordan " });
    expect(html).toContain("Hi Jordan,");
  });

  test("falls back to a neutral greeting, never 'Admin'", () => {
    for (const recipientName of [null, undefined, "", "   "]) {
      const { html } = buildTeamMemberJoinedEmail({ ...base, recipientName });
      expect(html).toContain("Hi there,");
      expect(html).not.toMatch(/Hi admin/i);
    }
  });

  test("uses the exotiq brand, never ExotIQ", () => {
    const { html, subject } = buildTeamMemberJoinedEmail({ ...base, recipientName: "Jordan" });
    expect(html).not.toContain("ExotIQ");
    expect(subject).not.toContain("ExotIQ");
    expect(html).toContain("Exotiq");
  });

  test("names the new member, their role and the team", () => {
    const { html, subject } = buildTeamMemberJoinedEmail({ ...base, recipientName: "Jordan" });
    expect(subject).toBe("New Team Member Joined: Sam Rivera");
    expect(html).toContain("Sam Rivera");
    expect(html).toContain("sam@example.com");
    expect(html).toContain("manager");
    expect(html).toContain("Acme Rentals");
  });

  test("escapes names the new member typed themself", () => {
    const { html } = buildTeamMemberJoinedEmail({
      ...base,
      newUserName: '<img src=x onerror="alert(1)">',
      recipientName: "<b>Jordan</b>",
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>Jordan</b>");
    expect(html).toContain("&lt;img");
  });
});
