

# Team Messaging Multi-Tenant Leak + Smoke Test

## Critical Finding: Cross-Tenant User Leakage

**Root cause**: `useTeamMessaging.ts` line 80-91 — `fetchTeamMembers()` queries `profiles` with **no team filter**:

```typescript
const { data } = await supabase
  .from('profiles')
  .select('id, full_name, email, avatar_url');
// Returns ALL 15 users across ALL 15 teams
```

This means when a user opens "New Conversation" → Direct/Group/Channel, they see users from other tenants. They can start conversations with people outside their team.

**Why RLS doesn't save us here**: The `profiles` SELECT policy allows admins to see all profiles (`has_role(auth.uid(), 'admin')`). So admin users see every profile in the system. Non-admins only see their own profile, which means the member list shows nobody — also broken.

### Secondary issue: `team_conversations` has no team scoping

The `team_conversations` table has a `team_id` column, but:
- The INSERT policy doesn't set it (`WITH CHECK (auth.uid() = created_by)`)
- The `createConversation` function never passes `team_id`
- The SELECT policy checks membership/creator — not team — so conversations aren't isolated by tenant

### Smoke Test Results (All Functions)

| Function | Status | Issue |
|----------|--------|-------|
| `fetchTeamMembers()` | **BROKEN** | Returns all users across all tenants, no team filter |
| `fetchConversations()` | **PARTIAL** | RLS scopes by membership but not by team. Company-wide convs from other teams could leak via `is_company_wide = true` |
| `createConversation()` | **BROKEN** | Never sets `team_id`. Cross-tenant conversations possible |
| `sendMessage()` | OK | Scoped to active conversation |
| `addReaction()` | OK | Scoped to message in active conversation |
| `uploadAttachment()` | OK | Scoped to user's storage path |
| `fetchMessages()` | OK | Scoped to conversation_id (but conversation itself may be cross-tenant) |
| Mention autocomplete | **BROKEN** | Uses same unfiltered `teamMembers` list |
| Presence/typing | OK | Scoped to conversation_id |
| Read receipts | OK | Scoped to conversation_id |
| Pinned messages | OK | Scoped to conversation_id |
| Message search | OK | Scoped to conversation_id |
| Edit/Delete messages | OK | RLS checks `sender_id = auth.uid()` |

## Fix Plan

### 1. Filter `fetchTeamMembers()` by current team

Replace the profiles query with a `team_members` join so only same-team users appear:

```typescript
// Get team members for current user's team
const { data: myTeam } = await supabase
  .from('team_members')
  .select('team_id')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .limit(1)
  .single();

const { data: members } = await supabase
  .from('team_members')
  .select('user_id, profiles(id, full_name, email, avatar_url)')
  .eq('team_id', myTeam.team_id)
  .eq('is_active', true);
```

### 2. Set `team_id` on conversation creation

When creating a conversation, pass the current team's ID so conversations are tenant-scoped.

### 3. Scope company-wide conversations by team

Change `fetchConversations()` to filter company-wide convs by team_id, not just `is_company_wide = true` globally.

### 4. Add team_id filter to `tc_select` RLS policy (defense in depth)

Update the SELECT policy on `team_conversations` to include a team membership check for company-wide conversations, so even if application code misses it, the DB enforces isolation.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useTeamMessaging.ts` | Filter `fetchTeamMembers` by team, set `team_id` on conversation creation, scope company-wide query by team |
| Database migration | Update `tc_select` RLS policy to scope `is_company_wide` by team_id |

## Risk
Low-medium. The fixes are filter additions — no structural changes. The `team_id` on conversations is already a column, just unused.

