import { useTeam } from "@/contexts/TeamContext";
import { safeTimeZone } from "@/lib/motoriq/facts";

/**
 * The time zone the tenant's business runs in: the selected location's zone if it has one, else the team's, else the
 * browser's. Days, "today" and anything Rari says about time are in this zone.
 */
export function useTenantTimeZone(): string {
  const { currentTeam, currentLocation, selectedLocationId } = useTeam();
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locationZone = selectedLocationId !== "all" ? (currentLocation as { timezone?: string | null } | null)?.timezone : null;
  return safeTimeZone(locationZone || (currentTeam as { timezone?: string | null } | null)?.timezone || browser);
}
