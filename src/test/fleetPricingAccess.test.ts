import { describe, it, expect } from 'vitest';
import { fleetPricingAccess } from '@/lib/fleetPricingAccess';

describe('fleetPricingAccess (matches the database rules)', () => {
  it('lets the team owner edit cars and team defaults', () => {
    expect(fleetPricingAccess({ isManagerOrHigher: true, userId: 'u1', teamOwnerId: 'u1' }))
      .toEqual({ canEditCars: true, canEditTeamDefaults: true });
  });

  it('lets a manager or admin edit cars but not the team row', () => {
    expect(fleetPricingAccess({ isManagerOrHigher: true, userId: 'u2', teamOwnerId: 'u1' }))
      .toEqual({ canEditCars: true, canEditTeamDefaults: false });
  });

  it('gives an operator or viewer neither', () => {
    expect(fleetPricingAccess({ isManagerOrHigher: false, userId: 'u3', teamOwnerId: 'u1' }))
      .toEqual({ canEditCars: false, canEditTeamDefaults: false });
  });

  it('never treats a missing id as the owner', () => {
    expect(fleetPricingAccess({ isManagerOrHigher: false, userId: undefined, teamOwnerId: undefined }).canEditTeamDefaults).toBe(false);
    expect(fleetPricingAccess({ isManagerOrHigher: false, userId: null, teamOwnerId: null }).canEditCars).toBe(false);
  });
});
