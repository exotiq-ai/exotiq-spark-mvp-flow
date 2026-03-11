

# Photo Hub Matching — Deep Dive & Fix Plan

## What's Actually Happening (Root Cause Analysis)

I traced your exact filename `Chevrolet_Corvette_Z06_Yellow.jpg` through the matcher. Here's why it fails:

### Bug 1: Model substring matching causes ties
The scorer checks `model.includes(token)` — meaning the token "corvette" matches BOTH `Corvette Z06` AND `Corvette Stingray`. Your Z06 Yellow file scores **12** against the Z06 Yellow vehicle, but ALSO **12** against the Stingray Yellow vehicle (same make + "corvette" substring + same color). With a gap of 0, confidence drops below "high" and it goes to the unmatched queue.

The same issue hits every Lamborghini Huracan upload — "huracan" matches Huracan, Huracan EVO, and Huracan STO equally.

### Bug 2: Hyphenated makes are broken
`Rolls-Royce` and `Mercedes-Benz` never match. The normalizer splits `Rolls-Royce_Cullinan_Blue.jpg` into tokens `['rolls', 'royce', 'cullinan', 'blue']`. But then `tokens.includes('rolls-royce')` returns false because the hyphen was already split. Same for `Mercedes-Benz` → tokens `['mercedes', 'benz']` vs make `mercedes-benz`. **Zero Rolls-Royce or Mercedes files can ever auto-match.**

### Bug 3: Color isn't weighted enough for disambiguation
When you have 3 Yellow Corvettes but only 1 is a Z06 Yellow, color alone (+2 points) can't break the tie created by the model substring bug.

### Is the AI actually scanning photos?
**Yes, it genuinely calls Gemini 2.5 Flash** with the image. The `identify-vehicle` edge function sends the photo to the AI and gets back make, model, color, angle, quality score. However, the AI results (`suggested_make`, `suggested_color`) are only stored in the `unmatched_photos` row — they're **never used to improve the filename match**. The two systems (filename matcher + AI vision) run independently and don't cross-reference.

---

## Fix Plan (2 files)

### 1. Rewrite `scoreVehicle` in `src/lib/filenameVehicleMatcher.ts`

**Hyphenated makes:** Before checking `tokens.includes(make)`, also try joining adjacent tokens with a hyphen. `['rolls', 'royce']` → try `'rolls-royce'` → matches make `rolls-royce`. Same fix for `aston martin` (space-separated makes): try joining adjacent tokens with space.

**Full model matching:** Instead of `model.includes(token)` (partial), split the model into words and count how many model words appear in the filename tokens. Score proportionally: `Corvette Z06` has 2 words, if both match → full score (10). If only "corvette" matches (1/2) → half score (5). This way `Corvette Z06` beats `Corvette Stingray` when the filename contains "z06".

**Color as tiebreaker:** Increase color weight from +2 to +3, enough to break ties between same make/model vehicles of different colors.

### 2. Show filename prominently in Review Queue — `src/components/photos/PhotoReviewQueue.tsx`

In single-photo mode (line ~392, AI Analysis section), add the original filename as a visible label above the AI analysis. Something like:
```
📄 Chevrolet_Corvette_Z06_Yellow.jpg
```
This removes guesswork for operators who don't know every car but can read the filename.

In batch mode (the grid cards, line ~640), show the filename below each thumbnail.

### 3. Cross-reference AI + filename in `usePhotoAnalysis.ts` (processBatch)

After AI analysis returns `suggested_make` / `suggested_color`, if the filename matcher returned `confidence: 'medium'`, check if the AI's detected make matches the filename-suggested vehicle's make. If they agree, upgrade to `'high'` confidence and auto-match. This combines both signals for stronger matching without extra API calls.

---

## Summary

| Fix | File | Impact |
|-----|------|--------|
| Fix hyphenated makes + full model matching + color weight | `filenameVehicleMatcher.ts` | Fixes Rolls-Royce, Mercedes-Benz, Corvette Z06 vs Stingray, Huracan vs EVO |
| Show filename in review queue | `PhotoReviewQueue.tsx` | Removes guesswork for manual matching |
| AI + filename cross-reference | `usePhotoAnalysis.ts` | Upgrades medium→high when both signals agree |

3 files, focused logic changes. No new dependencies, no API costs.

