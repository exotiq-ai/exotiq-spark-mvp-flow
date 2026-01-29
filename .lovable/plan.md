
# Photo Hub Upload Fix Plan

## Issues Identified

### Issue 1: Storage Bucket File Size Limit (CRITICAL)
The `vehicle-photos` bucket has a **5 MB file size limit**, but:
- The UI tells users "Max 10MB per file" - this is incorrect
- User's photos are larger than 5MB, causing ALL uploads to fail with "Payload too large"

**Solution:** Increase the bucket's file size limit to at least 20MB (or 50MB for high-res photos)

### Issue 2: Duplicate React Keys (WARNING)
In `BulkUploadModal.tsx` line 310:
```tsx
key={item.file.name}  // Duplicate filenames cause React errors
```

The user has two files with identical names ("Gregory - Tortilla Flats (Full Size)-48.jpg"), causing the React warning:
> "Encountered two children with the same key"

**Solution:** Use a unique key that combines filename with index

### Issue 3: Inconsistent Error Handling
When storage upload fails, the error isn't being surfaced clearly - files show as "Pending" but with 0% progress and "1 Failed" in summary.

---

## Implementation

### Step 1: Increase Storage Bucket File Size Limit (Backend)
Run SQL migration to update the bucket configuration:

```sql
UPDATE storage.buckets 
SET file_size_limit = 52428800  -- 50 MB
WHERE name = 'vehicle-photos';
```

### Step 2: Fix Duplicate Key Issue (Frontend)
Update `BulkUploadModal.tsx` line 310:

```tsx
// Before
key={item.file.name}

// After - use unique key with index
key={`${item.file.name}-${index}`}
```

### Step 3: Update UI File Size Messaging
Update `BulkUploadModal.tsx` line 217 to match the actual limit:

```tsx
// After increasing limit
<p className="text-sm text-muted-foreground mt-1">
  Supports JPG, PNG, WEBP • Max 50MB per file
</p>
```

### Step 4: Add Client-Side File Size Validation (Optional Enhancement)
Add pre-upload validation to catch oversized files before they hit the server:

```tsx
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const selectedFiles = Array.from(e.target.files || []).filter(f => {
    if (!f.type.startsWith('image/')) return false;
    if (f.size > MAX_FILE_SIZE) {
      toast.error(`${f.name} exceeds 50MB limit`);
      return false;
    }
    return true;
  });
  setFiles(prev => [...prev, ...selectedFiles]);
}, []);
```

### Step 5: Improve Error Messages
Update `usePhotoAnalysis.ts` to provide clearer error messages for storage failures:

```tsx
} catch (error) {
  let errorMessage = 'Upload failed';
  if (error instanceof Error) {
    if (error.message.includes('Payload too large') || 
        error.message.includes('exceeded the maximum')) {
      errorMessage = 'File too large - max 50MB';
    } else {
      errorMessage = error.message;
    }
  }
  // ... use errorMessage in progress update
}
```

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| Database migration | Increase bucket file_size_limit to 50MB | Critical |
| `src/components/photos/BulkUploadModal.tsx` | Fix duplicate key issue | High |
| `src/components/photos/BulkUploadModal.tsx` | Update file size messaging | High |
| `src/components/photos/BulkUploadModal.tsx` | Add client-side size validation | Medium |
| `src/components/photos/usePhotoAnalysis.ts` | Better error messages | Low |

---

## Verification Steps

After fixes:
1. Upload a large photo (10-20MB) - should succeed
2. Upload multiple photos with same filename - no React warnings
3. Upload oversized file (>50MB) - should show clear error before upload
4. Check console - no duplicate key warnings

---

## Technical Details

### Current Bucket Configuration
- **file_size_limit:** 5,242,880 bytes (5 MB)
- **allowed_mime_types:** image/jpeg, image/png, image/webp, image/heic
- **public:** false (correct)

### Recommended Bucket Configuration
- **file_size_limit:** 52,428,800 bytes (50 MB)
- Keeps same MIME types and privacy settings
