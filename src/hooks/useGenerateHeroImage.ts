import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { toast } from 'sonner';

interface GenerateHeroOptions {
  vehicleId: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
}

interface GenerateHeroResult {
  success: boolean;
  imageUrl?: string;
  photoId?: string;
  generatedAt?: string;
  error?: string;
}

export function useGenerateHeroImage() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateHero = useCallback(async (
    options: GenerateHeroOptions
  ): Promise<GenerateHeroResult> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-hero-image', {
        body: {
          vehicleId: options.vehicleId,
          make: options.make,
          model: options.model,
          year: options.year,
          color: options.color,
          userId: user.id,
          teamId: currentTeam?.id
        }
      });

      if (error) {
        console.error('Generate hero error:', error);
        return { success: false, error: error.message };
      }

      return data as GenerateHeroResult;
    } catch (err) {
      console.error('Generate hero exception:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    } finally {
      setIsGenerating(false);
    }
  }, [user, currentTeam]);

  const generateHeroWithToast = useCallback(async (
    options: GenerateHeroOptions
  ): Promise<GenerateHeroResult> => {
    const result = await generateHero(options);
    
    if (result.success) {
      toast.success('AI hero image generated!', {
        description: `Studio-quality preview created for ${options.make} ${options.model}`
      });
    } else {
      toast.error('Failed to generate hero image', {
        description: result.error || 'Please try again'
      });
    }

    return result;
  }, [generateHero]);

  return {
    generateHero,
    generateHeroWithToast,
    isGenerating
  };
}
