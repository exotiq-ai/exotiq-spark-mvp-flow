/** The short symbol for a currency code ("USD" → "$"), or the code itself when the browser doesn't know it. */
export function currencySymbol(currency: string): string {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}
