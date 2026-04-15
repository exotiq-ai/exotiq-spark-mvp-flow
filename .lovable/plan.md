

# Update Tenant Login Credentials

## What We're Doing
Changing the login email and password for the tenant account `exoticsbythebay@exotiq.ai` while keeping all their team data, fleet, bookings, and profile intact.

- **Current email**: `exoticsbythebay@exotiq.ai`
- **New email**: `info@exoticsbythebay.co`
- **New password**: `Exoticsbythebay2026!`
- **User ID**: `05668c86-0a4c-4217-858b-818ca12b94dc`

## Approach

1. **Create a temporary backend function** (`admin-update-user`) that uses admin privileges to update the email and password for the specified user ID.

2. **Run it once** to apply the changes.

3. **Update the `profiles` table** to sync the new email there as well (so the UI displays the correct email).

4. **Delete the temporary function** immediately after — it's a one-time operation.

## What Stays the Same
All tenant data is linked by `user_id` (UUID), not by email. So team membership, fleet, bookings, customers, payments, documents — everything remains intact. Only the login credentials change.

