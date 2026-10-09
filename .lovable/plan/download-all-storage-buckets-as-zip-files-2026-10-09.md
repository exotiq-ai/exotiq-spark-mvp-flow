# Download all storage buckets as ZIP files

Goal: give you a downloadable copy of every file in the nine storage buckets (about 2,523 files, around 520 MB). Folder paths stay exactly as they are, so you can upload them to the new backend unchanged.

Nothing in the live app changes. Files are only read, never moved or deleted.

## Steps

1. **List everything.** Get the current file list for each bucket: path, size and file type. Save it as `manifest.csv`. It's the checklist for confirming the copy is complete.
2. **Download each file** into a temporary workspace (not your app). Keep the original bucket and folder layout. Downloads run a few at a time and retry on failure.
3. **Check the copy.** Compare file counts and total size for each bucket against the list. Any missing or mismatched file gets reported by name. The ZIP is not called complete until every file matches.
4. **Zip it.** Build one ZIP per bucket so each download stays manageable (vehicle photos is the largest, about 450 MB or more). Also build a small `README.txt` with counts, sizes and file checksums.
5. **Deliver.** Put the ZIPs in your Files so you can download them from chat.

## Things to know

- Some buckets hold private renter documents (driver's licenses, damage photos, message attachments). Treat the ZIPs as sensitive. Delete them from Files after you've downloaded them, and keep them off shared drives.
- The ZIPs contain only the files. Access rules for the buckets are not included and have to be set up again on the new backend (they were already listed earlier).
- Files added after the download starts won't be in the ZIPs. Run this as close to cutover as you can, or run it again then.

## Technical details

- Reads go through the backend storage API with server-level read access, in a script that runs only in the sandbox. Nothing is deployed.
- Layout: `<bucket>/<original/object/path>`. Checksums: SHA-256 per file in `checksums.txt`.
- Built in `/tmp`, entries checked, then copied to `/mnt/documents/storage-export-2026-10-09/`.
- If server-level read access isn't available from the sandbox, the fallback is a temporary, owner-only, read-only download function. It gets removed right after the export, and I'll ask you before using it.
