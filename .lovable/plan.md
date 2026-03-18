

# Make Post-Tour Modal Dismissible

## What & Why
The `PostTourChoiceModal` backdrop currently blocks clicks intentionally. This creates friction and feels buggy since Esc already works. Clicking the backdrop should dismiss the modal the same way "Explore on My Own" does — no X button needed, just natural click-outside behavior.

## Change

**`src/components/onboarding/PostTourChoiceModal.tsx`**
- Add `onClick={onExplore}` to the backdrop `motion.div` (line ~68)
- The inner card already has `e.stopPropagation()`, so card clicks won't trigger dismissal
- No X button added — click-outside is sufficient and keeps the card clean

One file, one line changed.

