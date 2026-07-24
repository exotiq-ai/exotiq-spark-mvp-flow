// M6d formatting helpers shared by renter money / email functions.

export function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    USD: "$",
    GBP: "£",
    EUR: "€",
    CAD: "CA$",
    AUD: "A$",
  };
  return map[currency.toUpperCase()] ?? currency.toUpperCase();
}

export function formatCurrency(amount: number, currency = "USD"): string {
  const symbol = currencySymbol(currency);
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);
  const centsStr = cents.toString().padStart(2, "0");
  const wholeStr = whole.toLocaleString("en-US");
  return `${symbol}${wholeStr}.${centsStr}`;
}

export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const fmtStart = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const fmtEnd = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  if (sameMonth) {
    return `${fmtStart.format(start)}–${end.getDate()}`;
  }
  return `${fmtStart.format(start)} – ${fmtEnd.format(end)}`;
}

export function formatPickupTime(iso: string, timezone = "UTC"): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  });
  return fmt.format(new Date(iso));
}

export function formatPaymentDeadline(iso: string, timezone = "UTC"): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  });
  return fmt.format(new Date(iso));
}

export function shortVehicleName(name: string): string {
  // "2017 Audi S8 Plus" -> "Audi S8"; remove year and keep first two words after year.
  const cleaned = name.replace(/^\d{4}\s+/, "");
  const parts = cleaned.split(/\s+/);
  return parts.slice(0, 2).join(" ");
}

export function buildPayUrl(
  bookingRef: string,
  token: string,
  origin = "https://book.exotiq.rent",
): string {
  return `${origin}/booking/${encodeURIComponent(bookingRef)}?t=${encodeURIComponent(token)}`;
}

export function buildStorefrontUrl(
  teamSlug: string,
  origin = "https://book.exotiq.rent",
): string {
  return `${origin}/${encodeURIComponent(teamSlug)}`;
}

export function buildVehicleUrl(
  teamSlug: string,
  vehicleSlug: string,
  origin = "https://book.exotiq.rent",
): string {
  return `${origin}/${encodeURIComponent(teamSlug)}/${encodeURIComponent(vehicleSlug)}`;
}

/** Payment window: 48 hours from approval, capped at pickup - 2 hours.
 * Returns ISO string in UTC. */
export function computePaymentDueAt(
  pickupIso: string,
  approvedAtIso = new Date().toISOString(),
): string {
  const approvedAt = new Date(approvedAtIso).getTime();
  const pickup = new Date(pickupIso).getTime();
  const fortyEightHours = approvedAt + 48 * 60 * 60 * 1000;
  const pickupMinusTwoHours = pickup - 2 * 60 * 60 * 1000;
  return new Date(Math.min(fortyEightHours, pickupMinusTwoHours)).toISOString();
}
