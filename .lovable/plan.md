
# Safer @mentions for Team Chat

Goal: make tagging teammates unambiguous, abuse-resistant, and respectful of attention — without changing the look of Team Chat.

## 1. Identity model: display name + unique @handle

Add a `handle` field to `profiles` (citext, unique per team, 2–24 chars, `[a-z0-9_.]`).

- Backfill from `full_name` (slugified) or email-prefix, with numeric suffix on collision (`mike`, `mike2`).
- Settings → Profile gains a "Display name" and "@handle" field. Handle edits are rate-limited (1/30 days) and old handle reserved for 90 days so stale mentions don't re-bind.
- Autocomplete searches **both** `full_name` and `handle`; rendered token is always `@handle`. Hover/tap shows full name + role.
- Onboarding nudge banner for users with empty `full_name` ("Set your display name so teammates can @mention you").

## 2. Group mentions

Three tiers, all gated and confirmed:

| Mention | Who can use | Resolves to |
|---|---|---|
| `@owners` / `@admins` / `@managers` | Any member | Users with that role in `user_roles` for the team |
| `@all` (everyone in this conversation) | Admin+ only | All `conversation_members` |
| `@<group-name>` (custom departments) | Any member; managed by Admin+ | Members of a new `team_groups` table |

New tables (migration):
- `team_groups` (id, team_id, name, slug, description, created_by) + GRANTs + RLS scoped by team.
- `team_group_members` (group_id, user_id) + GRANTs + RLS.

Settings → Team gains a "Groups" panel (Admin+) to create groups like `@detailing`, `@sales`, `@front-desk` and assign members. No fake/preset groups — only what the team creates.

**Confirmation modal** appears in the composer before send when a message contains a group mention OR resolves to >3 unique recipients: "This will notify N people: [avatars]. Send?" with Cancel / Send.

## 3. Notification guardrails

In `mention-notification` edge function:

- **Membership check**: for every `mentionedUserId`, verify they're in `conversation_members` for `conversationId`. Drop any that aren't (prevents cross-channel pings via group expansion).
- **Dedupe window**: skip email/Slack if a row exists in a new `mention_notifications_log` table for (recipient, conversation, sender) within the last 60s. Always write a log row on send.
- **Self-exclusion**: never notify the sender (already done; keep).
- **Inactive filter**: skip users where `team_members.is_active = false`.

Client-side expansion of group mentions happens before invoking the function, so the function receives a flat `mentionedUserIds[]` — but the function re-validates membership server-side. Never trust the client list.

## 4. Inactive / deactivated teammates

- Autocomplete picker filters out `team_members.is_active = false`.
- Existing mention tokens in old messages render as `@Name (inactive)` in muted color, non-clickable, non-notifying.
- Reactivation restores normal rendering automatically (resolution is live, not snapshotted).

## 5. UI changes (presentation only)

- `MessageThread` mention picker: shows avatar, display name, @handle, role chip. Recent mentions float to top. Mobile uses bottom-sheet with sticky search.
- Mention token rendering: `@handle` pill, role-colored for group mentions (`@admins` = warning tint, `@all` = destructive tint to signal blast radius).
- Composer shows a small "Will notify N" hint next to the send button when mentions are present.

## 6. Out of scope (flagging for later)

- `@here` (only-online users) — needs presence integration, defer.
- Quiet hours respect — you opted out for v1; easy to add later by checking `notification_preferences` time window.
- Cross-conversation mentions (mentioning someone not in the channel to pull them in) — risky, defer.
- Push notifications for mentions (currently email + Slack only).

## Technical notes

**Files touched**
- New migration: `profiles.handle`, `team_groups`, `team_group_members`, `mention_notifications_log` (all with GRANTs + RLS scoped by team).
- `src/hooks/useTeamMessaging.ts` — expand group mentions client-side, pass flat user-id list.
- `src/components/messaging/MessageThread.tsx` (or mention picker subcomponent) — handle-based search, role/group entries, recipient-count hint.
- `src/components/messaging/MentionConfirmDialog.tsx` (new) — recipient-count modal.
- `src/components/settings/ProfileSettings.tsx` — handle field with availability check.
- `src/components/settings/TeamGroupsPanel.tsx` (new) — Admin+ group management.
- `supabase/functions/mention-notification/index.ts` — membership check, dedupe via `mention_notifications_log`, inactive filter.

**Backwards compatibility**
- Existing messages keep their stored mention markup. Resolution is live against `profiles.handle` / `full_name`, so renamed handles just re-render.
- Notification email template unchanged in v1.

**Risks called out**
- Handle uniqueness is per-team, not global. Cross-team DMs (if you ever add them) would need a global namespace.
- Group expansion can balloon recipient counts — the confirmation modal is the primary safeguard. The 60s dedupe is the secondary one.
- `mention_notifications_log` grows unbounded; add a 30-day retention sweep alongside your existing `retention_sweep_log` pattern.
