import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GasFeeConfig {
  gasFeeEnabled: boolean;
  gasFeeAmount: number;
  gasFeeDefaultOn: boolean;
  isLoading: boolean;
}

const DEFAULTS: Omit<GasFeeConfig, 'isLoading'> = {
  gasFeeEnabled: true,
  gasFeeAmount: 20,
  gasFeeDefaultOn: true,
};

/**
 * Reads gas fee configuration from the tenant's team settings.
 * Falls back to sensible defaults (enabled, $20, default on) when no settings exist.
 */
export function useTeamGasFeeSettings(): GasFeeConfig {
  const { user } = useAuth();
  const [config, setConfig] = useState<Omit<GasFeeConfig, 'isLoading'>>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', user.id)
          .eq('category', 'team')
          .maybeSingle();

        if (data?.settings && typeof data.settings === 'object') {
          const s = data.settings as Record<string, unknown>;
          setConfig({
            gasFeeEnabled: typeof s.gasFeeEnabled === 'boolean' ? s.gasFeeEnabled : DEFAULTS.gasFeeEnabled,
            gasFeeAmount: s.gasFeeAmount != null ? Number(s.gasFeeAmount) || DEFAULTS.gasFeeAmount : DEFAULTS.gasFeeAmount,
            gasFeeDefaultOn: typeof s.gasFeeDefaultOn === 'boolean' ? s.gasFeeDefaultOn : DEFAULTS.gasFeeDefaultOn,
          });
        }
      } catch (err) {
        console.error('Failed to load gas fee settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [user]);

  return { ...config, isLoading };
}
