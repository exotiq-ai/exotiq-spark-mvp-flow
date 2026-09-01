// Resolve the tax configuration for a booking.
//
// Precedence: the pickup location's own override (when set) → the workspace
// default. Every field is resolved independently, so a location can override
// only the rate and still inherit the workspace's label.
//
// Locations ship with all three fields NULL, so existing tenants resolve to
// exactly their workspace settings — no behavioural change.

export interface TaxSource {
  tax_rate_percent?: number | string | null;
  tax_label?: string | null;
  tax_inclusive?: boolean | null;
}

export interface ResolvedTax {
  tax_rate_percent: number;
  tax_label: string;
  tax_inclusive: boolean;
  /** true when at least one value came from the location override */
  from_location: boolean;
}

export function resolveTaxConfig(
  team?: TaxSource | null,
  location?: TaxSource | null,
): ResolvedTax {
  const locRate = location?.tax_rate_percent;
  const locLabel = location?.tax_label;
  const locInclusive = location?.tax_inclusive;

  const hasLocRate = locRate !== null && locRate !== undefined && locRate !== '';
  const hasLocLabel = !!(locLabel && String(locLabel).trim());
  const hasLocInclusive = locInclusive !== null && locInclusive !== undefined;

  return {
    tax_rate_percent: hasLocRate
      ? Number(locRate)
      : Number(team?.tax_rate_percent ?? 0) || 0,
    tax_label: hasLocLabel
      ? String(locLabel).trim()
      : (team?.tax_label && String(team.tax_label).trim()) || 'Tax',
    tax_inclusive: hasLocInclusive ? !!locInclusive : !!team?.tax_inclusive,
    from_location: hasLocRate || hasLocLabel || hasLocInclusive,
  };
}
