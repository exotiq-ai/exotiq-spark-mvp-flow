import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "sonner";
import { Json } from '@/integrations/supabase/types';

export type SettingsCategory = 'ai' | 'team' | 'system';

interface UseUserSettingsOptions<T> {
  category: SettingsCategory;
  defaultSettings: T;
}

export function useUserSettings<T>({
  category,
  defaultSettings,
}: UseUserSettingsOptions<T>) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<T>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', user.id)
          .eq('category', category)
          .maybeSingle();

        if (error) {
          console.error('Error loading settings:', error);
          return;
        }

        if (data?.settings) {
          // Merge with defaults to handle new settings fields
          setSettings(prev => ({
            ...prev,
            ...(data.settings as T),
          }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user, category]);

  // Save settings to database
  const saveSettings = useCallback(async (newSettings?: T): Promise<boolean> => {
    if (!user) {
      toast.error('Not authenticated', { description: 'Please log in to save settings.' });
      return false;
    }

    setIsSaving(true);
    const settingsToSave = newSettings || settings;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            category,
            settings: settingsToSave as unknown as Json,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,category',
          }
        );

      if (error) {
        console.error('Error saving settings:', error);
        toast.error('Error saving settings', { description: error.message });
        return false;
      }

      if (newSettings) {
        setSettings(newSettings);
      }

      return true;
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Error saving settings', { description: 'An unexpected error occurred.' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, category, settings, toast]);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof T>(
    key: K,
    value: T[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Update a deeply nested setting (for objects like automation.autoConfirmBookings)
  const updateNestedSetting = useCallback(<K extends keyof T>(
    categoryKey: K,
    key: string,
    value: unknown
  ) => {
    setSettings(prev => ({
      ...prev,
      [categoryKey]: {
        ...(prev[categoryKey] as Record<string, unknown>),
        [key]: value,
      },
    }));
  }, []);

  // Toggle a boolean setting
  const toggleNestedSetting = useCallback(<K extends keyof T>(
    categoryKey: K,
    key: string
  ) => {
    setSettings(prev => {
      const categoryObj = prev[categoryKey] as Record<string, unknown>;
      return {
        ...prev,
        [categoryKey]: {
          ...categoryObj,
          [key]: !categoryObj[key],
        },
      };
    });
  }, []);

  return {
    settings,
    setSettings,
    saveSettings,
    updateSetting,
    updateNestedSetting,
    toggleNestedSetting,
    isLoading,
    isSaving,
  };
}
