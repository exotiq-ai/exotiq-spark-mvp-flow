# Studio Hero v2 — Finishing and Super Admin review

## What the new Maybach test proved
One Nano Banana Pro benchmark used Gregory's front-quarter and side photos with recipe v2.2. It did not change the live hero, upload examples into the gallery, overwrite the saved identity sheet, or consume tenant attempts.

- Correct black paint and left-facing front three-quarter composition; solid polished dish wheels are much closer to the supplied references.
- Independent review scored vehicle fidelity **8/10** and studio **10/10**, but **rejected** the result because the lower bumper mesh became black instead of chrome.
- Human review is stricter than that studio score: the floor reflection is too faint, wall texture too prominent, and a faint line near the upper edge needs review. No clear lightbox is visible, but this is not yet a final approved hero.
- This is evidence of improvement, not a model winner or proof of repeatability. Live renderer stays unchanged.

## 1. Finish identity understanding
- Analyze genuine exterior photos plus wheel, badge and bumper detail references; exclude interiors and previous generated images.
- Save explicit wheel face geometry, perimeter opening count separately from spoke count, chrome mesh/material details, trim, body kit, paint and roof state.
- Include source evidence and uncertainty per important detail. Do not invent hidden features; if evidence is inadequate, retain the current hero and request a better reference.
- Refresh the identity sheet when relevant photos or vehicle details change, while preserving reviewed corrections with provenance.
- Keep uploaded example references separate from the vehicle's authoritative photos until explicitly confirmed as that vehicle.

## 2. Lock the studio recipe and improve review
- Correct the Maybach's chrome lower intakes using the new source evidence; test a detail-targeted correction rather than casually rewriting the whole prompt.
- Keep one fixed style image, camera position, left-facing layout and neutral soft lighting. Strengthen the soft floor reflection and subdued wall texture checks.
- Require separate checks for direction, wheels, bumper materials, badges, paint, roof, full framing, wall, lighting and reflection. A high overall score must never excuse a failed item.
- Invalid, missing or unavailable review means **waiting for review**, never automatic approval. Provider refusals or denied access stop the request.
- Validate structured review results and score ranges; do not treat a model's claimed pass alone as approval.

## 3. Benchmark before live rollout
- Freeze the approved difficult reference set: Maybach, Urus, red GT3, blue G63 Brabus, black GLE Brabus, Dawn, R8 and GT4 RS, subject to genuine source availability.
- Compare the current baseline and candidate under recorded recipes; repeat difficult cases to measure consistency, not one lucky image.
- Show failures, first-attempt pass rate, actual measured cost, time and human ratings. Keep the existing baseline even if its model is deprecated; do not silently replace it.
- Change the live recipe/model only after matching or exceeding baseline fidelity and studio consistency and Gregory's approval. Existing approved heroes remain untouched.

## 4. Super Admin upgrades
Extend the existing tenant Studio hero photos area rather than adding a separate disconnected tool.
- Vehicle review queue with original photos, saved identity details, current hero and candidate side by side; zoom wheels, badges and bumpers.
- Show model, recipe, review failures, attempt history, timestamp and measured cost when available.
- Allow corrected identity details, selection of genuine reference photos and one controlled test render.
- Approve or reject candidates; approval must still satisfy required review checks. Rejected images never appear in renter galleries.
- Keep the current per-vehicle reset, add confirmed fleet-wide reset, and audit both. Resetting never automatically rerenders the fleet.
- Display benchmark comparisons and an explicit gated recipe activation action with rollback to the prior approved version.
- All review, reset, activation and promotion actions remain server-authorized for active Super Admins and audited.

## 5. Safe production behavior
- Render asynchronously after a suitable upload, without blocking onboarding. Preserve originals and the existing hero until a candidate passes.
- Reserve attempts atomically so simultaneous requests cannot exceed **three total generations**. Permit two rerenders after the first; then notify **hello@exotiq.ai** and show support status.
- Review-service recovery does not regenerate the image or spend another generation attempt. Retry only transient rate/server failures with bounded delayed backoff; pause credit/policy-blocked work and never retry provider denials/refusals.
- Promote through one atomic, authorized operation: hero selection, visibility, order and shared image reference stay consistent or none change.
- Use the selected hero once as the main photo; original non-hero photos follow in the gallery, without duplicate hero or failed/replaced generated images.
- Invalidate operator-app photo queries after promotion. Coordinate renter-app cache/gallery changes with its owner; do not edit the live renter app from this project.
- Retain the feature kill switch and stage rollout on approved test vehicles before enabling broader automatic rendering.

## Technical details and acceptance
- Persist immutable recipe snapshots, identity evidence/source revisions, review outcomes, run identifiers and measured usage. Define migrations additively with explicit grants and team-scoped access.
- Atomic generation reservation and promotion require server-side transactions and authorization; no service-role bypass without explicit tenant and Super Admin validation.
- Add focused tests for tenant/Super Admin isolation, stale identity refresh, failed/malformed review never promoting, concurrent three-attempt cap, review-only recovery, atomic promotion and hero deduplication.
- Exercise signed-in upload → identity → render → review → promotion → read-back on fleet, photo hub and available renter views. Verify desktop and mobile framing and rollback behavior.
- No rollout claims until these flows pass. Actual costs and performance remain unverified until recorded across the benchmark.

## Build order
1. Identity evidence and review validation, followed by the remaining Maybach detail correction test.
2. Super Admin side-by-side review and benchmark history.
3. Fixed-set repeated benchmark and Gregory's recipe/model approval.
4. Atomic attempts/promotion, fail-closed live review and cache coordination.
5. End-to-end checks and controlled automatic rollout.