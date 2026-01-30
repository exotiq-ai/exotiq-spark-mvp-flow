import { useTeam } from '@/contexts/TeamContext';

/**
 * Hook to check if the current team is a demo account
 * 
 * Demo accounts show placeholder/sample content for demos
 * Production accounts show real data only (empty states when no data)
 * 
 * Usage:
 * const isDemoAccount = useDemoAccount();
 * {isDemoAccount ? <DemoContent /> : <RealContent />}
 */
export const useDemoAccount = (): boolean => {
  const { currentTeam } = useTeam();
  
  // Check for is_demo_account flag on team
  // Falls back to false if not set (production default)
  return (currentTeam as any)?.is_demo_account ?? false;
};

/**
 * Hook to conditionally render content based on demo status
 * Returns null for non-demo accounts when there's no real data
 */
export const useDemoOrRealContent = <T>(
  realData: T[] | null | undefined,
  demoFallback: T[]
): T[] => {
  const isDemoAccount = useDemoAccount();
  
  // If we have real data, always use it
  if (realData && realData.length > 0) {
    return realData;
  }
  
  // If demo account and no real data, use demo fallback
  if (isDemoAccount) {
    return demoFallback;
  }
  
  // Production account with no data - return empty array
  return [];
};
