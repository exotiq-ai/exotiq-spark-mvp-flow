

# AI Hero Generation & Smart Vehicle Identification

## Executive Summary

This plan adds two complementary features to the Photo Hub:

1. **Gemini-based Vehicle Identification** - Replace Google Vision (which is returning empty results) with Gemini 2.5 Flash for better make/model/color detection
2. **AI Hero Generation** - Generate professional "showroom preview" images on demand using Nano Banana (Gemini 2.5 Flash Image)

Both use Lovable AI (no additional API keys needed) and integrate cleanly with the existing Photo Hub infrastructure.

---

## Current State Analysis

### What's Working
| Component | Status |
|-----------|--------|
| Photo Hub upload flow | Working |
| Storage (vehicle-photos bucket) | Working |
| PhotoRoom enhancement | Working |
| Static asset mapping (50 vehicles) | Working |
| VehicleThumbnail fallback chain | Working (just fixed) |

### What's Broken
| Component | Issue |
|-----------|-------|
| Google Vision API | Returns empty `labels: []` for recent uploads |
| Vehicle identification | Can't detect make/model/color reliably |

### Current Edge Functions
```text
analyze-vehicle-photo    → Google Vision (broken)
enhance-hero-photo       → PhotoRoom (working, ~$0.02/image)
```

---

## Proposed Architecture

### New Edge Functions

```text
┌──────────────────────────────────────────────────────────────┐
│                    AI PHOTO PROCESSING                       │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────┐    ┌─────────────────────┐
│ identify-vehicle    │    │ generate-hero-image │
│ (NEW)               │    │ (NEW)               │
│                     │    │                     │
│ Input: Photo URL    │    │ Input: Make/Model/  │
│ Output: Make, Model,│    │        Year/Color   │
│         Color, Year │    │ Output: Studio-     │
│                     │    │         quality PNG │
│ API: Gemini 2.5     │    │ API: Gemini 2.5     │
│      Flash          │    │      Flash Image    │
│ Cost: ~$0.003/call  │    │ Cost: ~$0.04/image  │
└─────────────────────┘    └─────────────────────┘
```

---

## Cost Analysis

### Per-Vehicle Costs

| Operation | API | Cost | Notes |
|-----------|-----|------|-------|
| Identify vehicle | Gemini Flash | ~$0.003 | Text analysis of image |
| Generate hero | Gemini Flash Image | ~$0.04 | One-time generation |
| **Total per vehicle** | | **~$0.043** | |

### Fleet Size Projections

| Fleet Size | Total Cost | Notes |
|------------|------------|-------|
| 10 cars | $0.43 | Typical small fleet |
| 20 cars | $0.86 | Average customer |
| 50 cars | $2.15 | Large fleet |
| 100 cars | $4.30 | Enterprise |

**Verdict**: Highly cost-effective for one-time hero generation.

---

## DALL-E vs Gemini Flash Image Comparison

| Factor | Gemini Flash Image | DALL-E 3 |
|--------|-------------------|----------|
| **Cost** | ~$0.04/image | ~$0.04-0.08/image |
| **Quality** | Good, consistent style | Higher detail, more realistic |
| **Speed** | ~3-5 seconds | ~10-15 seconds |
| **API Key** | Built-in (Lovable AI) | Requires user API key |
| **Car accuracy** | Good for exotic cars | Better for obscure models |
| **Integration** | Zero config | Manual setup |

**Recommendation**: Use **Gemini Flash Image** (built-in) for MVP. Quality is sufficient for dashboard thumbnails. DALL-E can be added as a premium option later if users request higher fidelity.

---

## Implementation Plan

### Phase 1: Smart Vehicle Identification

**New Edge Function: `identify-vehicle`**

```text
File: supabase/functions/identify-vehicle/index.ts

Purpose: Replace Google Vision with Gemini for vehicle detection

Input:
  - imageUrl: string (photo URL or base64)
  - filename?: string

Output:
  - isVehicle: boolean
  - confidence: number (0-100)
  - make: string (e.g., "Ferrari")
  - model: string (e.g., "488 GTB")
  - year?: number (e.g., 2019)
  - color: string (e.g., "Rosso Corsa Red")
  - angle: string (e.g., "front_quarter")
  - bodyStyle: string (e.g., "coupe", "SUV")

Prompt Strategy:
  "Analyze this vehicle photo. Identify:
   1. Is this a vehicle? (yes/no with confidence)
   2. Make and model (be specific, e.g., 'Lamborghini Huracán EVO')
   3. Approximate year or generation
   4. Exterior color (use manufacturer color names if recognizable)
   5. Camera angle (front, rear, side, front_quarter, etc.)
   6. Body style (coupe, sedan, SUV, convertible, etc.)
   
   Return JSON format only."
```

**Integration Points:**
- Update `usePhotoAnalysis.ts` to call `identify-vehicle` instead of `analyze-vehicle-photo`
- Keep `analyze-vehicle-photo` as fallback/legacy
- Store results in existing `ai_analysis` JSONB column

### Phase 2: AI Hero Generation

**New Edge Function: `generate-hero-image`**

```text
File: supabase/functions/generate-hero-image/index.ts

Purpose: Generate studio-quality hero images on demand

Input:
  - vehicleId: string
  - make: string (e.g., "Ferrari")
  - model: string (e.g., "488 GTB")
  - year?: number
  - color?: string (e.g., "red", "Rosso Corsa")

Output:
  - success: boolean
  - imageUrl: string (signed URL to stored image)
  - generatedAt: string (ISO timestamp)

Prompt Template:
  "Professional automotive photography of a {year} {make} {model} 
   in {color}. Front 3/4 angle view, showroom setting with 
   clean white/light gray gradient background. Studio lighting, 
   high-end commercial photography style. The car should be 
   the main subject, centered, with subtle shadow beneath.
   Photorealistic, 4K quality."
```

**Storage Strategy:**
- Save to `vehicle-photos` bucket under `generated/{vehicleId}/hero-{timestamp}.png`
- Create signed URL (1 year expiry)
- Store in `vehicle_photos` table with `photo_type: 'generated_hero'`

### Phase 3: Database Schema Update

**Add column to track generated images:**

```sql
-- Add source column to distinguish uploaded vs generated photos
ALTER TABLE vehicle_photos 
ADD COLUMN source TEXT DEFAULT 'uploaded' 
CHECK (source IN ('uploaded', 'generated', 'enhanced'));

-- Add generation metadata
ALTER TABLE vehicle_photos 
ADD COLUMN generation_prompt TEXT;

-- Index for quick lookup of generated heroes
CREATE INDEX idx_vehicle_photos_generated 
ON vehicle_photos (vehicle_id, source) 
WHERE source = 'generated';
```

### Phase 4: UI Integration

**Option A: Auto-generate on vehicle creation (Recommended)**

```text
Workflow:
1. User adds new vehicle (make, model, year, color)
2. System auto-generates hero image in background
3. Vehicle immediately displays generated hero
4. User can later upload real photos to replace

Location: AddVehicleDialog.tsx
- After vehicle insert, call generate-hero-image
- Show loading skeleton until ready
- No user action required
```

**Option B: Manual "Generate Preview" button**

```text
Workflow:
1. Vehicle shows placeholder icon
2. User clicks "Generate Preview" button
3. Loading state while generating
4. Hero appears when complete

Location: VehiclePhotoManager.tsx
- Add "Generate AI Preview" button in empty state
- Show in vehicle detail photo section
```

**Recommendation**: Implement Option A (auto-generate) with Option B as backup for existing vehicles without photos.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/identify-vehicle/index.ts` | Gemini-based vehicle detection |
| `supabase/functions/generate-hero-image/index.ts` | AI hero image generation |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/photos/usePhotoAnalysis.ts` | Switch to new identify-vehicle function |
| `src/components/dialogs/AddVehicleDialog.tsx` | Auto-generate hero after vehicle creation |
| `src/components/photos/VehiclePhotoManager.tsx` | Add "Generate Preview" button |
| `src/components/common/VehicleThumbnail.tsx` | Handle `source: 'generated'` badge |
| `supabase/config.toml` | Register new edge functions |
| Database migration | Add `source` and `generation_prompt` columns |

---

## User Workflow (After Implementation)

### New Vehicle Flow

```text
1. User clicks "Add Vehicle"
2. Enters: Make: Ferrari, Model: 488 GTB, Year: 2019, Color: Red
3. Clicks "Create"
4. Vehicle appears in fleet with AI-generated hero (3-5 seconds)
5. User can upload real photos anytime to replace
```

### Existing Vehicle Without Photos

```text
1. User opens vehicle that has no photos
2. Sees placeholder with "Generate AI Preview" button
3. Clicks button
4. Loading state (3-5 seconds)
5. Professional hero image appears
6. Image saved permanently to database
```

---

## Safety Considerations

### No Risk to Existing Functionality

| Concern | Mitigation |
|---------|------------|
| Breaking existing photo uploads | New functions are additive; existing `analyze-vehicle-photo` remains |
| Overwriting real photos | Generated photos stored with `source: 'generated'`; real uploads have `source: 'uploaded'` |
| Cost overruns | Generation is opt-in per vehicle; no batch generation without user action |
| UI confusion | Generated photos can show subtle "AI Preview" badge |

### Rollback Plan

If issues arise, simply:
1. Disable the "auto-generate" feature flag
2. Keep the edge functions deployed but unused
3. No data loss possible (all generated images are tracked separately)

---

## Success Metrics

After implementation, we should see:

- All new vehicles display a hero image immediately (no empty placeholders)
- Vehicle identification correctly detects make/model for 90%+ of exotic cars
- Fleet dashboard looks professional and complete
- Photo upload still works exactly as before
- Users can still upload real photos to replace generated ones

---

## Summary

| Phase | Effort | Value |
|-------|--------|-------|
| 1. Identify Vehicle (Gemini) | 2-3 hours | Fixes broken Vision API, better accuracy |
| 2. Generate Hero Image | 2-3 hours | No more empty vehicle cards |
| 3. Database Schema | 30 min | Track generated vs uploaded |
| 4. UI Integration | 2-3 hours | Seamless user experience |

**Total Estimated Effort**: 6-9 hours

**Cost Impact**: ~$0.04 per vehicle (one-time)

**Risk Level**: Low (additive features, no breaking changes)

