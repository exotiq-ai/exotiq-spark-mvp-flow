/**
 * Who may do what in Fleet → Pricing. Mirrors the database row-level rules so the screen never offers a save the
 * database will refuse:
 * - vehicles: "Users can update vehicles" allows team admins and managers (and the car's creator);
 * - teams: "Only owners can update team settings" allows the team owner only.
 */
export interface PricingAccess {
  /** Sees the Pricing tab and can edit each car's price rules. */
  canEditCars: boolean;
  /** Can change the team defaults (stored on the team row). */
  canEditTeamDefaults: boolean;
}

export function fleetPricingAccess(opts: {
  isManagerOrHigher: boolean;
  userId: string | null | undefined;
  teamOwnerId: string | null | undefined;
}): PricingAccess {
  const isTeamOwner = !!opts.userId && !!opts.teamOwnerId && opts.userId === opts.teamOwnerId;
  return {
    canEditCars: opts.isManagerOrHigher || isTeamOwner,
    canEditTeamDefaults: isTeamOwner,
  };
}
