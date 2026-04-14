

# Fix: Disable Scroll on Charges/Adjustments Number Input

The adjustment amount input in the "Add Charges / Adjustments" section (line 570-576) is missing the `onWheel` scroll prevention that was already added to the discount and payment amount fields.

## Change

**File: `src/components/dialogs/RecordPaymentDialog.tsx` (line 576)**

Add `onWheel={(e) => e.currentTarget.blur()}` to the adjustment amount `<Input>` — same pattern already used on the discount and amount fields.

