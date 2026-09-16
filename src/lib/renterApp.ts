/**
 * The renter-facing booking app is a separate site from this operator app.
 * Storefront links must always point at that host — a same-origin path like
 * `/{slug}` lands on this app's catch-all "not found" screen.
 *
 * Override per environment with VITE_RENTER_APP_URL (e.g. a staging renter host)
 * so non-production builds never link to the live renter site.
 */
export const RENTER_APP_BASE_URL: string = (
  (import.meta.env.VITE_RENTER_APP_URL as string | undefined) || 'https://book.exotiq.rent'
).replace(/\/+$/, '');

/** Full public storefront URL for a team slug. */
export const renterStorefrontUrl = (slug?: string | null): string =>
  slug ? `${RENTER_APP_BASE_URL}/${slug}` : RENTER_APP_BASE_URL;

/** Same URL without the scheme — nicer to display and to paste. */
export const renterStorefrontDisplayUrl = (slug?: string | null): string =>
  renterStorefrontUrl(slug).replace(/^https?:\/\//, '');
