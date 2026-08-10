# Why Settings shows your name in a DERC support session

## Short answer: no tenant leakage

Two separate things are being shown in Settings, and only one of them is tenant data:

- **My Account** — always your own login (Gregory Ringler / Drive Exotiq). A support session changes which *tenant's data* you can see; it never changes who you are signed in as. This tab reads the profile of the signed-in user by design, so it correctly shows you.
- **Business profile** — the tenant's data (business name, region, currency, support email). This is DERC data.

Checked in the database: Denver Exotic Rental Cars' owner is **J Davidson**, and DERC's member list is Jay (owner), Laura Amoruso (admin), you (admin, via support access), plus one inactive manager. Nothing from Drive Exotiq has crossed into DERC, and nothing of DERC's has been written under your profile.

## Is it safe to change?

Do not edit anything on **My Account** while in a support session — those fields write to *your* Drive Exotiq profile, not Jay's. Any DERC business information changes belong on the **Business profile** tab, which is safe to edit during an active support session.

One caveat worth fixing: saving Business profile also mirrors the business name onto the team owner's profile record (Jay's), which is intended, but there is nothing in the UI telling you that.

## Proposed changes

1. **Hide "My Account" during a support session.** When an active support grant is in effect for the tenant you're viewing, replace the My Account tab content with a short notice: "You're in a support session for Denver Exotic Rental Cars. Your personal account settings are not editable here — end the session to manage your own profile." This removes the possibility of accidentally editing your own profile while working in a customer account.

2. **Show the tenant owner on Business profile.** Add a read-only "Account owner" line at the top of the Business profile card showing the team owner's name and email (J Davidson), so it's immediately obvious whose business you're editing and that it isn't you.

3. **Make the support banner clearer.** Keep the existing amber support banner, but state the tenant name and that all edits are attributed to your real user id, so anything you change in DERC is auditable.

## Technical notes

- `src/components/dashboard/settings/MyAccountSection.tsx` reads `profiles` filtered by `user.id` — correct behavior, so the fix is gating the tab, not changing the query.
- Support-session state is already available via `useSupportSession()`; gate the `account` case in `SettingsLayout.tsx` on an active grant whose `team_id` matches `currentTeam.id`.
- `BusinessProfileSection.tsx` already has `currentTeam.owner_id`; fetch the owner's `full_name` for the read-only display line. No schema change and no new policies needed.
