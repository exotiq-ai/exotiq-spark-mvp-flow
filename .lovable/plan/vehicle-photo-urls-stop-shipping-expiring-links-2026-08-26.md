# Vehicle photo URLs: stop shipping expiring links

Verified against the live database and the bucket before writing this. What I found:

- `vehicle-photos` bucket is **already public** in production (`public = t`), while the last migration in the repo set it private — the repo is out of date, exactly as described.
- `vehicle_photos`: 640 rows. 198 `url` values and 436 `thumbnail_url` values are `/object/sign/` links. Every row has a `storage_path` (column is NOT NULL), and every stored thumbnail matches the `_thumb.jpg` convention derived from `storage_path` — so the derive-and-re-sign fix is safe. 791 `_thumb.jpg` objects exist in the bucket, so some rows will legitimately have no thumb.
- `is_visible` / `is_vehicle_confirmed` already default to `true` and currently have **zero NULLs**. The `eq()` filter is still wrong (any future NULL disappears, and it disagrees with the RPCs), so both halves of Fix 2 get done: match the RPC semantics in the function *and* lock the columns down.
- `vehicles`: 439 rows — 332 public URLs, 52 signed, 49 `/lovable-uploads/...`, 6 null. The 49 filesystem-path vehicles have **zero** `vehicle_photos` rows (they are two shared demo images), so there is nothing to backfill from; they get nulled and fall through to the existing client image cascade.
- `enhanced_url` is public-form or null everywhere — no signed values there.
- A sample `/object/public/` URL fetches HTTP 200, confirming the public form is the right target.

## Order of operations

1. **Bucket state first** (nothing else is correct until the public form is guaranteed): migration recording `vehicle-photos` as public, storage write policies untouched.
2. **Code: stop minting signed URLs on write** — so the migration in step 3 isn't re-dirtied by the next upload.
3. **Data migration** rewriting all signed and non-https values.
4. **`rent-public-media`**: thumbnail re-signing + NULL-safe filters + corrected comment.
5. **Schema hardening** on the two flag columns.
6. Re-run the acceptance SQL and fetch every hero URL for both teams.

## Migrations

**M1 — bucket state.** Set `vehicle-photos` public through the platform's bucket tool (direct SQL against `storage.buckets` is rejected), and leave a migration comment documenting that the bucket is public and that reads are unauthenticated by design. The four `TO authenticated` write/read policies from `20260715211500` stay exactly as they are — writes remain team-scoped. I verified all four are still present.

**M2 — URL rewrite (data).** Single pass, deterministic, derived from `storage_path`:

```text
base = https://<project>.supabase.co/storage/v1/object/public/vehicle-photos/

vehicle_photos.url            -> base || storage_path            where url LIKE '%/object/sign/%'
vehicle_photos.thumbnail_url  -> base || regexp_replace(storage_path,'\.[^.]+$','_thumb.jpg')
                                 where thumbnail_url LIKE '%/object/sign/%'
                                 AND the _thumb.jpg object exists in storage.objects
                              -> NULL where it does not
vehicles.image_url            -> the rewritten hero photo's coalesce(enhanced_url, url)
                                 where image_url LIKE '%/object/sign/%'
vehicles.image_url            -> NULL where image_url NOT LIKE 'https://%'   (the 49 demo paths)
```

Path segments are URL-encoded where needed. Run after the code change so no new signed rows land mid-flight.

**M3 — flag hardening.** `UPDATE ... SET is_visible = true WHERE is_visible IS NULL` (and the same for `is_vehicle_confirmed`) as a no-op safety net, then `ALTER COLUMN ... SET NOT NULL` on both. Defaults are already `true`.

## Code changes

- `src/lib/photoUpload.ts` — replace both `createSignedUrl` calls (main + thumb) with `getPublicUrl`; keep returning `storage_path` / `thumbnailPath` unchanged.
- `src/components/photos/usePhotoAnalysis.ts` (2 call sites) and `src/components/photos/AddVehicleFromPhotoWizard.tsx` (1 call site) — same swap.
- `src/hooks/usePhotoReviewQueue.ts` keeps its 1-hour signing: that is a transient in-memory preview, never persisted. Not touched.
- `supabase/functions/rent-public-media/index.ts`:
  - select `storage_path, display_order` and build the thumb path from `storage_path`; sign originals and thumbs in **one** `createSignedUrls` batch; return `thumbnailUrl: null` when the thumb object didn't sign.
  - swap `.eq("is_visible", true)` / `.eq("is_vehicle_confirmed", true)` for `.not(..., "is", false)` to match `coalesce(..., true)` in the RPCs.
  - rewrite the stale "bucket is private" header comment: the bucket is public, and this endpoint exists to serve an ordered, marketplace-validated gallery — the signing TTL is a delivery detail, not the access control.
- `supabase/functions/generate-hero-image/index.ts` — already writes `getPublicUrl`; no change, now backed by a committed public bucket.

## Conflicts and calls I'm making

- **Signing vs a public bucket.** With the bucket public, `rent-public-media`'s signed URLs are ceremony — the underlying object is fetchable either way. I'm keeping the signing (the renter app already re-fetches per request, and I don't want to change its contract in the same pass), but flagging that a later simplification is to return public URLs and drop the TTL entirely. Say the word if you want that folded in now.
- **`sync_hero_to_vehicle` needs no change.** It copies `coalesce(enhanced_url, url)`; once those are public-form, so is `vehicles.image_url`. Fixing the source is enough.
- **The 49 demo vehicles get no gallery.** They have no photo rows and only two shared demo images between them, so there is nothing to backfill — a real gallery means uploading real photos for those Exotiq demo cars. Nulling `image_url` is correct for external readers; internally the existing resolution cascade already covers it.
- I am not touching `src/lib/vehicleImageMapping.ts` or `VehicleThumbnail.tsx` in this pass. Once the data is clean their filters are dead weight, but removing them is a separate cleanup with its own regression surface.

## Verification

- The three acceptance SQL counts (signed URLs, non-https `image_url`, flag NULLs) must all be zero.
- `rent-public-media` called for an Exotics By The Bay vehicle: fresh `signedUrl` **and** `thumbnailUrl` on rows that have a thumb, `null` where they don't; and a spot-check on a row whose flags I temporarily read as NULL-equivalent.
- Fetch every `hero_image_url` from `public_team_fleet` for both teams and assert HTTP 200 across the board — reported back as a count, not a claim.
