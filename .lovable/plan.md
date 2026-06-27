
# Contextual @mentions — Tier 1 + Tier 2 (v2)

Bring @mentions to the records where work actually happens. Same engine as team chat; new home: inside bookings, inspections, work orders, damage claims, customer profiles, vehicles, documents, and Daily Brief items.

## What the user gets

A new **Activity** thread on every meaningful record. Supports `@handle`, `@owners/@admins/@managers`, `@all`, custom `@<group>`. Deep-linked notifications: *"Mike mentioned you on Booking BK-01042"* → one click opens the record with the thread auto-scrolled to the comment.

```text
┌─ Booking BK-01042 ────────────────────────────────────┐
│  [Details] [Documents] [Payments] [Activity (3) •]   │
├───────────────────────────────────────────────────────┤
│  💬 @mike can deposit be confirmed?         2h  ⋯    │
│      Resolved ✓ by @mike                              │
│  💬 @ops prep car Friday AM                 12m       │
│  ─────────────────────────────────────────────────── │
│  Comment… type @ to mention      [📎]  ⌘↵ to send    │
└───────────────────────────────────────────────────────┘
```

The "•" pulses when there are unread mentions for the current user.

## Surfaces (build order)

**Tier 1**
1. BookingDetailsDialog / EnhancedBookingDialog — Activity tab
2. WorkOrderDetailSheet + TaskDetailSheet — inline thread
3. CheckInOutDialog / InspectionWidget — thread on the inspection
4. DamageReportDialog / DamageClaimsSection — thread on the claim (immutable, see Risks)

**Tier 2**
5. CustomerProfileDialog — Activity tab (separate from existing CustomerTimeline)
6. VehicleDetailsDialog / Vehicle Command Center — per-vehicle ops thread
7. Tenant document viewer — comment on uploaded docs
8. DailyBriefCard "Needs" items — **"Assign to…"** affordance that posts a templated comment on the underlying record and tags the chosen teammate

## Shared building blocks

### `<EntityCommentThread />`
```tsx
<EntityCommentThread
  entityType="booking" | "work_order" | "vehicle_task" | "inspection"
            | "damage_claim" | "customer" | "vehicle" | "document"
  entityId={record.id}
  teamId={record.team_id}
  recordLabel="BK-01042"
  recordHref="/dashboard/bookings/BK-01042"
  density="compact" | "comfortable"
  allowAttachments={false}    // v1: text + mentions only
  immutable={false}           // true for damage_claim → no edit/delete
/>
```

Internals: realtime-subscribed query on `entity_comments`, reuses `MentionPicker`, `MentionConfirmDialog`, `parseMentions()`. Optimistic insert with RLS-failure rollback + toast.

### `<EntityCommentBadge count unread />`
Tab/row chip showing total + unread-for-me. Drives the pulsing dot.

### Hooks
- `useEntityComments(entityType, entityId)` — list + realtime + post + resolve + delete
- `useEntityMentionContext(teamId)` — resolves team members + groups; **shared cache** across all open threads to avoid N queries
- `useEntityCommentUnread(entityType, entityId)` — count of mentions of me since my last read receipt
- `useEntityCommentSearch(query)` — feeds global Cmd+K

### Edge function `entity-mention-notification`
- Allow-list of valid `entityType` values (defense-in-depth vs RLS).
- Re-runs the SELECT-policy access check per recipient before notifying (prevents leaks through stale client state).
- 60s dedupe via `mention_notifications_log`; key `(recipient, entity_type, entity_id, sender)`.
- Rate-limit: max 30 comment-notifications/user/hour (returns 429, comment still saved).
- Email subject + Slack message include record label + deep link; payload typed.

### Notification routing
Add notification type `entity_mention` with payload `{ entityType, entityId, commentId }`. UnifiedNotificationCenter routes click → record detail → auto-open Activity tab → scroll-to + flash the comment.

### Read receipts / unread state
New tiny table `entity_comment_reads(user_id, entity_type, entity_id, last_read_at, PK)`. Upserted on thread open. Unread count = comments with `created_at > last_read_at` AND user is in `mentions`.

### Mute per thread
`notification_preferences.muted_threads jsonb` array of `{entityType,entityId}`. "Mute this thread" item in thread overflow menu. Edge function skips muted recipients.

## Database changes (single migration)

1. **Rewrite `entity_comments` SELECT policy** as a `SECURITY DEFINER` helper function `public.can_access_entity(user_id, entity_type, entity_id)` returning bool. Policy becomes a one-liner. Covers: booking, vehicle, customer, payment, damage_claim *(existing)* + work_order, vehicle_task, vehicle_inspection, tenant_document, customer_note, partner_payout *(new)*. Avoids the giant OR chain and fixes future-extensibility.
2. **Tighten INSERT policy** — currently only checks `auth.uid() = user_id`. Add `AND public.can_access_entity(auth.uid(), entity_type, entity_id)` so users can't post comments on records they can't see.
3. **Add UPDATE policy clause** preventing edits when `entity_type = 'damage_claim'` (audit-trail integrity for insurance/legal).
4. Index: `entity_comments(entity_type, entity_id, created_at desc)`.
5. New table `entity_comment_reads` with grants + RLS (user_id = auth.uid()).
6. Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.entity_comments;`
7. Add `'entity_mention'` value to notifications type (text column; no enum change needed per current schema).

All policies re-checked with `supabase--linter` post-migration.

## File map

**New (10)**
- `src/components/comments/EntityCommentThread.tsx`
- `src/components/comments/EntityCommentComposer.tsx`
- `src/components/comments/EntityCommentItem.tsx`
- `src/components/comments/EntityCommentBadge.tsx`
- `src/hooks/useEntityComments.ts`
- `src/hooks/useEntityMentionContext.ts`
- `src/hooks/useEntityCommentUnread.ts`
- `src/lib/entityCommentRoutes.ts`
- `supabase/functions/entity-mention-notification/index.ts`
- `supabase/migrations/<ts>_entity_comments_v2.sql`

**Edited (wire-in only)**
BookingDetailsDialog, EnhancedBookingDialog, WorkOrderDetailSheet, TaskDetailSheet, CheckInOutDialog, InspectionWidget, DamageReportDialog, DamageClaimsSection (badge on rows), CustomerProfileDialog, VehicleDetailsDialog, tenant document viewer, DailyBriefCard, UnifiedNotificationCenter, global Cmd+K search.

**Tests**
- `mentions.test.ts` extended with entity-context expansion
- `entityCommentRoutes.test.ts` — every entityType → label + href
- RLS contract test: cross-team user cannot SELECT/INSERT comments on another team's records
- E2E (Playwright): mention on booking → notification appears → click → record opens → comment flashed

## UX details that matter

- **Composer keyboard**: ⌘/Ctrl+Enter sends; Esc closes picker; ↑/↓ navigates picker; Tab/Enter selects.
- **Empty state**: first-time copy — *"Tag a teammate with @ to start a conversation about this booking."*
- **Accessibility**: `aria-live="polite"` on the thread; focus returns to composer after send; mention pills have `aria-label="Mention: Mike Chen, owner"`.
- **Mobile**: thread becomes a bottom-sheet on `<sm`; picker is full-width with larger tap targets.
- **Inactive teammates**: hidden from picker; historical mentions render `@Name (inactive)` muted, non-clickable, no notify.
- **Group safety**: `MentionConfirmDialog` triggers on any group mention OR recipient count > 3.
- **Resolve workflow**: any team member can mark a comment resolved; resolved comments collapse to one line with strike-through option; reopen available.
- **Demo seed**: add 2–3 realistic comments to the demo team's top bookings/work orders so the panel doesn't look empty on `/demo`.

## Telemetry

Lightweight client event `entity_mention.posted { entityType, recipientCount, hasGroupMention }`. No PII. Feeds the decision on whether Tier 3 surfaces (photo review, partner payouts) are worth building.

## Rollout

1. Migration + edge function + shared components — dark ship.
2. Feature flag `entityMentions`: on for demo team only.
3. Tier 1 wired (booking → work order → inspection → damage claim).
4. Flip flag on for all teams. Monitor mention volume + 429 rate for a week.
5. Tier 2 wired in follow-up PR.

## Risks & mitigations

- **Notification spam** → 60s dedupe, group confirm, per-thread mute, hourly rate-limit.
- **Cross-tenant leak via malformed entityType** → server-side allow-list + `can_access_entity()` helper re-check.
- **Realtime cost** → one channel per open dialog, torn down on close; shared `useEntityMentionContext` cache; throttle re-fetch on rapid postgres_changes.
- **Damage-claim audit integrity** → comments on `damage_claim` are immutable (no edit/delete) at the RLS layer.
- **Optimistic insert reveals forbidden record** → optimistic UI only renders own comment; rollback + toast on RLS reject.
- **N+1 on lists with badges** → single batched query `select entity_id, count, max(created_at)` keyed by the visible record ids.

## Out of scope (v1)

- Emoji reactions, file attachments (column exists, wire later), inline photo/line-item quoting, push notifications, SLA escalation, AI-suggested assignee. All callable as v2.
