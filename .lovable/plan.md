# Fix: Drive Exotiq activity leaking into DERC's activity feeds

## What's happening

The "marketplace booking created" entries on DERC's Team Hub — both the Recent Activity list and the Team Hub activity tab with the Logins/Bookings/Payments/Team filters — are not DERC bookings. They are Drive Exotiq activity records for Gregory Ringler.

Confirmed by inspecting the data:
- All 14 `marketplace_booking_created` records belong to the Drive Exotiq team, none to DERC.
- Gregory is an active member of the DERC team (from support access), so his name/user ID is in DERC's member list.

Both surfaces share one data hook. That hook builds its query by collecting the team's member user IDs and then pulling every activity row for those users — regardless of which team the activity happened in. Because Gregory belongs to both teams, his Drive Exotiq activity appears on DERC's hub. The activity rows already store the team they belong to; the feed just isn't using it.

This is a display-scoping bug, not a data leak of DERC records, and no DERC booking data is wrong.

## The fix

1. Scope the activity feed by the team the activity belongs to, instead of by member user IDs. Rows without a team stay hidden from team feeds.
2. Scope the realtime subscription refresh the same way so live inserts from another tenant don't repopulate the feed.
3. Stamp the current team on newly written activity records so future entries are always attributable to one tenant.
4. Re-check the Team Hub after the change on both DERC and Drive Exotiq to confirm each shows only its own activity.

## Technical notes

- File: `src/hooks/useTeamActivity.ts` — replace the `team_members` → `user_id` `.in(...)` lookup with `.eq('team_id', currentTeam.id)`; the existing row-level security policy already permits owner/admin/manager reads scoped by `team_id`. This one change fixes both consumers: `TeamActivityDashboard.tsx` (Team Hub tab) and `widgets/LiveActivityStrip.tsx` (Recent Activity).
- Add `team_id: currentTeam.id` to the insert in `logActivity`.
- No database migration or data change required; existing rows already carry the correct team.
