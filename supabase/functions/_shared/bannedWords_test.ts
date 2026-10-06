// Renter-facing wording guard: Stripe text, emails and receipts must never use
// these terms. Run: deno test supabase/functions/_shared/bannedWords_test.ts
const BANNED = [/card processing/i, /surcharge/i, /convenience fee/i, /\bcoverage\b/i, /\binsurance\b/i];

const FILES = [
  "supabase/functions/send-renter-email/templates.ts",
  "supabase/functions/rent-checkout/index.ts",
  "supabase/functions/rent-payment-webhook/index.ts",
  "supabase/functions/rent-extend-booking/index.ts",
  "supabase/functions/rent-refund-booking/index.ts",
];

// Only quoted strings count; comments and identifiers are ignored.
function renterStrings(src: string): string[] {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return noComments.match(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g) ?? [];
}

Deno.test("no banned words in renter-facing strings", async () => {
  const hits: string[] = [];
  for (const f of FILES) {
    const src = await Deno.readTextFile(f);
    for (const s of renterStrings(src)) {
      for (const re of BANNED) if (re.test(s)) hits.push(`${f}: ${re} in ${s.slice(0, 80)}`);
    }
  }
  if (hits.length) throw new Error("Banned renter wording:\n" + hits.join("\n"));
});
