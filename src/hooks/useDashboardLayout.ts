import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Layout } from 'react-grid-layout';

export interface WidgetConfig {
  id: string;
  name: string;
  component: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
}

export const availableWidgets: WidgetConfig[] = [
  { id: 'banner', name: 'Dashboard Banner', component: 'BannerWidget', defaultSize: { w: 12, h: 2 }, minSize: { w: 6, h: 2 } },
  { id: 'revenue', name: 'Revenue Analytics', component: 'RevenueWidget', defaultSize: { w: 12, h: 3 }, minSize: { w: 6, h: 3 } },
  { id: 'metrics', name: 'Key Metrics', component: 'MetricsWidget', defaultSize: { w: 12, h: 2 }, minSize: { w: 6, h: 2 } },
  { id: 'ai-insight', name: 'AI Insights', component: 'AIInsightWidget', defaultSize: { w: 12, h: 3 }, minSize: { w: 6, h: 3 } },
  { id: 'fleet-status', name: 'Fleet Status', component: 'FleetStatusWidget', defaultSize: { w: 6, h: 3 }, minSize: { w: 6, h: 3 } },
  { id: 'schedule', name: 'Upcoming Schedule', component: 'ScheduleWidget', defaultSize: { w: 6, h: 3 }, minSize: { w: 6, h: 3 } },
  { id: 'modules', name: 'Module Grid', component: 'ModuleGridWidget', defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 4 } },
];

const defaultLayout: Layout[] = [
  { i: 'banner', x: 0, y: 0, w: 12, h: 2 },
  { i: 'revenue', x: 0, y: 2, w: 12, h: 3 },
  { i: 'metrics', x: 0, y: 5, w: 12, h: 2 },
  { i: 'ai-insight', x: 0, y: 7, w: 12, h: 3 },
  { i: 'fleet-status', x: 0, y: 10, w: 6, h: 3 },
  { i: 'schedule', x: 6, y: 10, w: 6, h: 3 },
  { i: 'modules', x: 0, y: 13, w: 12, h: 4 },
];

const defaultVisibleWidgets = availableWidgets.map(w => w.id);

export const useDashboardLayout = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [layout, setLayout] = useState<Layout[]>(defaultLayout);
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(defaultVisibleWidgets);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLayout();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadLayout = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_dashboard_layouts')
        .select('layout_data, visible_widgets')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setLayout(data.layout_data as unknown as Layout[]);
        setVisibleWidgets(data.visible_widgets as unknown as string[]);
      }
    } catch (error) {
      console.error('Error loading dashboard layout:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveLayout = async (newLayout: Layout[], newVisibleWidgets: string[]) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_dashboard_layouts')
        .upsert({
          user_id: user.id,
          layout_data: newLayout as any,
          visible_widgets: newVisibleWidgets as any,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setLayout(newLayout);
      setVisibleWidgets(newVisibleWidgets);

      toast({
        title: "Layout Saved",
        description: "Your dashboard layout has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
      toast({
        title: "Error Saving Layout",
        description: "Failed to save your dashboard layout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetLayout = async () => {
    await saveLayout(defaultLayout, defaultVisibleWidgets);
    toast({
      title: "Layout Reset",
      description: "Your dashboard has been reset to the default layout.",
    });
  };

  const toggleWidget = (widgetId: string) => {
    const newVisibleWidgets = visibleWidgets.includes(widgetId)
      ? visibleWidgets.filter(id => id !== widgetId)
      : [...visibleWidgets, widgetId];
    
    setVisibleWidgets(newVisibleWidgets);
  };

  const addWidget = (widgetId: string) => {
    if (visibleWidgets.includes(widgetId)) return;

    const widget = availableWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    const newVisibleWidgets = [...visibleWidgets, widgetId];
    
    // Find the highest y position
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    
    const newLayout = [
      ...layout,
      {
        i: widgetId,
        x: 0,
        y: maxY,
        w: widget.defaultSize.w,
        h: widget.defaultSize.h,
      }
    ];

    setLayout(newLayout);
    setVisibleWidgets(newVisibleWidgets);
  };

  return {
    layout,
    visibleWidgets,
    loading,
    saveLayout,
    resetLayout,
    toggleWidget,
    addWidget,
    setLayout,
  };
};