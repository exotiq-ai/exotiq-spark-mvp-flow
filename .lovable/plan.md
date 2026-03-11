

# Add Personality to Photo Upload Progress

## Current State
The processing view shows a generic "Processing photos..." label with a progress bar. Users want more warmth and context about what Rari is actually doing.

## Enhancement Plan

### File: `src/components/photos/BulkUploadModal.tsx`

**Lines 322-330: Replace static processing header with animated personality**

Replace:
```
<div className="flex items-center justify-between text-sm">
  <span className="font-medium">
    {isComplete ? 'Upload Complete' : 'Processing photos...'}
  </span>
  <span className="text-muted-foreground">{overallProgress}%</span>
</div>
```

With an engaging rotating message that cycles through:
- "Sit back and relax — Rari is refining your images..."
- "Analyzing angles and quality with AI magic..."
- "Matching photos to your fleet vehicles..."
- "Compressing and optimizing for fast loading..."
- "Almost there — finalizing your uploads..."

Each message appears for 3 seconds with a fade transition. The progress bar stays, but the copy now feels alive and explains what's actually happening behind the scenes.

### Implementation Details
- Use `useEffect` + `setInterval` to cycle messages based on progress ranges
- First 0-25%: Relax message
- 25-50%: Analyzing message  
- 50-75%: Matching message
- 75-90%: Compressing message
- 90-100%: Almost there message
- Add Sparkles icon next to the message for visual delight

**No new dependencies. Single file change. Keeps existing progress bar and file list.**

