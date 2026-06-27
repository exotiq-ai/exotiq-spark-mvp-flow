// Centralised @mention parsing and recipient expansion.
// Supports:
//   @handle          → single user (matched on profiles.handle)
//   @owners | @admins | @managers → role-based group (from user_roles)
//   @all             → everyone in the conversation
//   @<group-slug>    → custom team group from team_groups
//
// All expansion happens client-side for the picker UI; the edge function
// re-validates that each recipient is actually a conversation member.

export type MentionKind = "user" | "role" | "all" | "group";

export interface MentionToken {
  /** raw text of the @reference (without leading @) */
  ref: string;
  kind: MentionKind;
  /** display label rendered in the pill */
  label: string;
  /** users this mention resolves to */
  userIds: string[];
}

export interface MentionableMember {
  id: string;
  handle: string | null;
  name: string;
  email?: string;
  role?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
}

export interface MentionableGroup {
  slug: string;
  name: string;
  member_ids: string[];
}

export interface MentionContext {
  /** Active conversation members (used for @all + filtering) */
  conversationMemberIds: string[];
  /** All team members (active only — picker hides inactive) */
  teamMembers: MentionableMember[];
  /** Custom team groups */
  groups: MentionableGroup[];
}

export const ROLE_MENTIONS: { slug: string; role: string; label: string }[] = [
  { slug: "owners", role: "owner", label: "@owners" },
  { slug: "admins", role: "admin", label: "@admins" },
  { slug: "managers", role: "manager", label: "@managers" },
];

const MENTION_RE = /@([a-zA-Z0-9_.-]{1,32})/g;

/**
 * Parse @-tokens out of message content and resolve each to a set of user ids.
 * Tokens that don't resolve to anything are left untouched (rendered as plain text).
 */
export const parseMentions = (
  content: string,
  ctx: MentionContext,
  currentUserId?: string,
): { tokens: MentionToken[]; recipientIds: string[] } => {
  const tokens: MentionToken[] = [];
  const seen = new Set<string>();
  const recipients = new Set<string>();
  const memberSet = new Set(ctx.conversationMemberIds);

  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(content)) !== null) {
    const ref = match[1];
    if (seen.has(ref.toLowerCase())) continue;
    seen.add(ref.toLowerCase());

    const token = resolveMention(ref, ctx);
    if (!token) continue;
    tokens.push(token);

    for (const uid of token.userIds) {
      // Always exclude sender from notification recipients
      if (uid === currentUserId) continue;
      // Only notify people who are actually in this conversation
      if (memberSet.size > 0 && !memberSet.has(uid)) continue;
      recipients.add(uid);
    }
  }

  return { tokens, recipientIds: Array.from(recipients) };
};

export const resolveMention = (
  ref: string,
  ctx: MentionContext,
): MentionToken | null => {
  const lower = ref.toLowerCase();

  // @all
  if (lower === "all" || lower === "channel" || lower === "here") {
    return {
      ref,
      kind: "all",
      label: "@all",
      userIds: [...ctx.conversationMemberIds],
    };
  }

  // role
  const role = ROLE_MENTIONS.find((r) => r.slug === lower);
  if (role) {
    const userIds = ctx.teamMembers
      .filter((m) => m.role === role.role && m.is_active !== false)
      .map((m) => m.id);
    return { ref, kind: "role", label: role.label, userIds };
  }

  // custom group
  const group = ctx.groups.find((g) => g.slug.toLowerCase() === lower);
  if (group) {
    return {
      ref,
      kind: "group",
      label: `@${group.slug}`,
      userIds: [...group.member_ids],
    };
  }

  // user handle (exact match)
  const userByHandle = ctx.teamMembers.find(
    (m) => m.handle && m.handle.toLowerCase() === lower,
  );
  if (userByHandle) {
    return {
      ref,
      kind: "user",
      label: `@${userByHandle.handle}`,
      userIds: [userByHandle.id],
    };
  }

  // legacy: first-name match (for messages typed before handles existed)
  const userByName = ctx.teamMembers.find(
    (m) => m.name.split(" ")[0]?.toLowerCase() === lower,
  );
  if (userByName) {
    return {
      ref,
      kind: "user",
      label: `@${userByName.handle || userByName.name.split(" ")[0]}`,
      userIds: [userByName.id],
    };
  }

  return null;
};

export interface PickerItem {
  key: string;
  ref: string; // the text that gets inserted after the @
  kind: MentionKind;
  label: string; // display in picker
  sublabel?: string;
  recipientCount: number;
  avatar_url?: string | null;
}

/**
 * Build the autocomplete picker list (users first, then groups, then roles, then @all).
 */
export const buildPickerItems = (
  query: string,
  ctx: MentionContext,
  canMentionAll: boolean,
  currentUserId?: string,
): PickerItem[] => {
  const q = query.toLowerCase().trim();
  const items: PickerItem[] = [];

  // Users
  for (const m of ctx.teamMembers) {
    if (m.id === currentUserId) continue;
    if (m.is_active === false) continue;
    const ref = m.handle || m.name.split(" ")[0]?.toLowerCase() || "";
    if (!ref) continue;
    const haystack = `${ref} ${m.name}`.toLowerCase();
    if (q && !haystack.includes(q)) continue;
    items.push({
      key: `user:${m.id}`,
      ref,
      kind: "user",
      label: m.name || `@${ref}`,
      sublabel: `@${ref}${m.role ? ` · ${m.role}` : ""}`,
      recipientCount: 1,
      avatar_url: m.avatar_url,
    });
  }

  // Custom groups
  for (const g of ctx.groups) {
    if (q && !g.slug.toLowerCase().includes(q) && !g.name.toLowerCase().includes(q)) continue;
    items.push({
      key: `group:${g.slug}`,
      ref: g.slug,
      kind: "group",
      label: `@${g.slug}`,
      sublabel: `${g.name} · ${g.member_ids.length} members`,
      recipientCount: g.member_ids.length,
    });
  }

  // Role mentions
  for (const r of ROLE_MENTIONS) {
    if (q && !r.slug.startsWith(q)) continue;
    const count = ctx.teamMembers.filter((m) => m.role === r.role && m.is_active !== false).length;
    if (count === 0) continue;
    items.push({
      key: `role:${r.slug}`,
      ref: r.slug,
      kind: "role",
      label: r.label,
      sublabel: `${count} ${r.role}${count === 1 ? "" : "s"}`,
      recipientCount: count,
    });
  }

  // @all (admin+ only)
  if (canMentionAll && (!q || "all".startsWith(q))) {
    items.push({
      key: "all",
      ref: "all",
      kind: "all",
      label: "@all",
      sublabel: `Notify everyone in this conversation (${ctx.conversationMemberIds.length})`,
      recipientCount: ctx.conversationMemberIds.length,
    });
  }

  return items.slice(0, 8);
};
