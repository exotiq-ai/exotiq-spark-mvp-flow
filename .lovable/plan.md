# Fix: photo delete silently fails, and where the black Lambo came from

## What's actually happening

**1. The delete is a no-op that reports success.**

The Huracan EVO Spyder for Exotics by the Bay has 4 photos. One (the white hero) was uploaded by the tenant's own account. The other three — including the black one — were uploaded on Aug 8 by the Exotiq staff account (hello@exotiq.ai), most likely during a support/setup session on their workspace.

The delete permission rule on the photo table is `user_id = auth.uid()` — you can only delete a photo row **you personally uploaded**. Team ownership is not considered, even though viewing and editing are team-scoped. So when the Exotics by the Bay user deletes a photo uploaded by Exotiq staff:

- the delete matches zero rows
- the database returns **no error** (deleting nothing is legal)
- the app treats "no error" as success and shows "Photo deleted"
- the next refresh re-fetches the photo, still there

The same mismatch applies to the underlying image file in storage: the file lives under the uploader's folder path, so the tenant's request to remove it is also rejected silently.

**2. This is not cross-tenant pollution.** All four photo rows carry the correct Exotics by the Bay workspace ID and are attached to their own vehicle record. Nothing leaked in from another operator. The black car image is a stock/AI-render file (`Lamborghini_Huracan_EVO_Spyder_Black_Cherry.jpg`) that was uploaded into their account by us, not by them — it's the wrong car color for their actual vehicle, which is why it looks out of place.

## The fix

### A. Make deletion team-scoped (root cause)

Replace the delete rule on vehicle photos so any member of the owning workspace with edit rights can delete a photo belonging to their workspace — matching how viewing and editing already work. Same change for the unmatched-photo review queue, which has the identical uploader-only rule.

Storage: allow deletion of a vehicle-photo file when the requester belongs to the workspace that owns the corresponding photo record, instead of matching on the folder-name-equals-your-user-id convention.

### B. Never report success when nothing was deleted

Change the delete call to ask the database which rows it actually removed. If zero rows come back, throw a clear error so the UI shows a real failure ("You don't have permission to delete this photo") instead of a false success toast. Apply the same guard to the storage removal so a rejected file delete is surfaced too.

This is the safety net: even if a permission rule is wrong somewhere in future, the user will never again be told something was deleted when it wasn't.

### C. Clean up the wrong-car photos on this account

Remove the two stale extra photos on their Huracan (the black-cherry render and the duplicate white render uploaded the same night), leaving their real hero photo. Confirm with the operator first that they want all three staff-uploaded images gone versus just the black one.

### D. Audit for the same pattern elsewhere

Sweep the remaining workspace-scoped tables for delete rules still keyed to the individual uploader rather than the workspace, and list any others found so they can be corrected in the same pass. (Report only — no blind changes.)

## Technical notes

- Policy change via migration on `public.vehicle_photos` and `public.unmatched_photos`: replace the `DELETE ... USING (user_id = auth.uid())` policy with one using the existing team-membership helper, plus a role check so Viewers can't delete.
- Storage policy on `storage.objects` for the `vehicle-photos` bucket: delete permitted when a `vehicle_photos`/`unmatched_photos` row with that `storage_path` belongs to a workspace the caller is a member of.
- `usePhotoAnalysis.deletePhoto`: add `.select('id')` to the delete and throw when the returned array is empty; check the storage `remove()` error/result rather than discarding it.
- No schema changes; no changes to upload or hero-photo logic.
