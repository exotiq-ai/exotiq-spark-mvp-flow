import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import GridLayout, { Layout } from "react-grid-layout";
import { Edit3, Save, RotateCcw, Plus, X } from "lucide-react";
import { useDashboardLayout, availableWidgets } from "@/hooks/useDashboardLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { WidgetLibrary } from "./WidgetLibrary";
import { BannerWidget } from "./widgets/BannerWidget";
import { RevenueWidget } from "./widgets/RevenueWidget";
import { CompactMetricsBar } from "./widgets/CompactMetricsBar";
import { CompactAIInsightBanner } from "./widgets/CompactAIInsightBanner";
import { FleetStatusWidget } from "./widgets/FleetStatusWidget";
import { ScheduleWidget } from "./widgets/ScheduleWidget";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useFleetAIInsight } from "@/hooks/useFleetAIInsight";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface Module {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
}

interface CustomizableDashboardProps {
  modules: Module[];
  onModuleClick: (moduleId: string) => void;
}

export const CustomizableDashboard = ({ modules, onModuleClick }: CustomizableDashboardProps) => {
  const [searchParams] = useSearchParams();
  const safeMode = searchParams.get('safe') === '1';
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { vehicles, bookings, applyPriceOptimization } = useLocationFilteredFleet();
  const { layout, visibleWidgets, loading, saveLayout, resetLayout, toggleWidget, setLayout } = useDashboardLayout();
  const aiInsight = useFleetAIInsight(vehicles, bookings);

  // Calculate metrics for CompactMetricsBar
  const activeBookingsCount = bookings.filter(b => b.status === 'confirmed').length;
  const currentUtilization = vehicles.length > 0 
    ? Math.round((activeBookingsCount / vehicles.length) * 100) 
    : 0;
  const averageRate = vehicles.length > 0 
    ? Math.round(vehicles.reduce((acc, v) => acc + (v.current_rate || 0), 0) / vehicles.length) 
    : 0;

  // Responsive width with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setContainerWidth(width > 0 ? width : 1200);
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLayoutChange = (newLayout: Layout[]) => {
    if (isEditMode) {
      setLayout(newLayout);
    }
  };

  const handleSaveLayout = () => {
    saveLayout(layout, visibleWidgets);
    setIsEditMode(false);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    window.location.reload(); // Reload to reset layout changes
  };

  const renderWidget = (widgetId: string) => {
    const widgetComponents: { [key: string]: JSX.Element } = {
      'banner': <BannerWidget />,
      'revenue': <RevenueWidget />,
      'metrics': (
        <CompactMetricsBar
          activeBookings={activeBookingsCount}
          utilization={currentUtilization}
          averageRate={averageRate}
          onNavigate={onModuleClick}
        />
      ),
      'ai-insight': aiInsight ? (
        <CompactAIInsightBanner
          vehicleName={aiInsight.vehicleName}
          suggestedIncrease={aiInsight.suggestedIncreasePercent}
          potentialRevenue={aiInsight.potentialMonthlyRevenue}
          onApply={() => setShowOptimizationDialog(true)}
          onViewAnalysis={() => onModuleClick('motoriq')}
          hasFleetData={vehicles.length > 0}
        />
      ) : <div />,
      'fleet-status': <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />,
      'schedule': <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />,
      'modules': (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {modules.map((module) => (
            <Button
              key={module.id}
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => onModuleClick(module.id)}
            >
              <module.icon className={`h-6 w-6 ${module.color}`} />
              <span className="text-xs font-medium">{module.name}</span>
            </Button>
          ))}
        </div>
      ),
    };

    return widgetComponents[widgetId] || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
        <span className="sr-only">Loading dashboard layout...</span>
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" aria-hidden="true"></div>
      </div>
    );
  }

  const filteredLayout = layout.filter(item => visibleWidgets.includes(item.i));
  
  // Mobile: force single column, full width for all widgets (data-only, GridLayout will position them)
  const mobileLayout = filteredLayout.map(item => ({
    ...item,
    x: 0,
    w: 12,
    static: !isEditMode
  }));

  const finalLayout = isMobile ? mobileLayout : filteredLayout;

  // Safe mode: render widgets in simple vertical stack (no grid engine)
  if (safeMode) {
    return (
      <>
        <PriceOptimizationDialog
          open={showOptimizationDialog}
          onOpenChange={setShowOptimizationDialog}
          vehicles={vehicles}
          onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
        />
        <div className="space-y-4 md:space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <h2 className="text-lg md:text-xl font-semibold">Your Dashboard (Safe Mode)</h2>
            <Badge variant="secondary">Grid Disabled</Badge>
          </div>
          <div className="space-y-4">
            {filteredLayout.map((item) => (
              <div key={item.i} className="w-full">
                {renderWidget(item.i)}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehicles}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />

      <div className="space-y-4 md:space-y-6">
        {/* Customize Controls */}
        <div 
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border"
          role="toolbar"
          aria-label="Dashboard customization controls"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg md:text-xl font-semibold">Your Dashboard</h2>
            {isEditMode && (
              <Badge variant="secondary" className="animate-pulse">
                Edit Mode Active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AskRariQuickAction 
              variant="button"
              prompt="Analyze my dashboard metrics and provide insights on fleet operations and performance."
            />
            {!isEditMode ? (
              <Button
                onClick={() => setIsEditMode(true)}
                className="touch-target min-h-[44px]"
                aria-label="Enter edit mode to customize dashboard"
              >
                <Edit3 className="h-4 w-4 mr-2" aria-hidden="true" />
                Customize Dashboard
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => setShowWidgetLibrary(!showWidgetLibrary)}
                  variant="outline"
                  className="touch-target min-h-[44px]"
                  aria-label={showWidgetLibrary ? "Close widget library" : "Open widget library"}
                  aria-expanded={showWidgetLibrary}
                >
                  {showWidgetLibrary ? (
                    <>
                      <X className="h-4 w-4 mr-2" aria-hidden="true" />
                      Close Library
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                      Add Widgets
                    </>
                  )}
                </Button>
                <Button
                  onClick={resetLayout}
                  variant="outline"
                  className="touch-target min-h-[44px]"
                  aria-label="Reset dashboard to default layout"
                >
                  <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Reset
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  variant="ghost"
                  className="touch-target min-h-[44px]"
                  aria-label="Cancel editing"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveLayout}
                  className="touch-target min-h-[44px]"
                  aria-label="Save dashboard layout"
                >
                  <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                  Save Layout
                </Button>
              </>
            )}
          </div>
        </div>

        {isEditMode && (
          <div 
            className="p-4 bg-accent/10 border border-accent/30 rounded-lg"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Edit Mode:</strong> {isMobile ? "Widgets are arranged in a single column on mobile. " : "Drag widgets to rearrange, resize by dragging corners. "}
              Click "Add Widgets" to show/hide widgets, or "Reset" to restore defaults.
            </p>
          </div>
        )}

        {/* Widget Library Panel */}
        {showWidgetLibrary && (
          <WidgetLibrary
            visibleWidgets={visibleWidgets}
            onToggleWidget={toggleWidget}
            onClose={() => setShowWidgetLibrary(false)}
          />
        )}

        {/* Grid Layout */}
        <div ref={containerRef} className="w-full">
          <GridLayout
            className="layout"
            layout={finalLayout}
            cols={12}
            rowHeight={isMobile ? 60 : 80}
            width={containerWidth}
            isDraggable={isEditMode && !isMobile}
            isResizable={isEditMode && !isMobile}
            onLayoutChange={handleLayoutChange}
            compactType="vertical"
            preventCollision={false}
            margin={isMobile ? [8, 8] : [16, 16]}
            containerPadding={[0, 0]}
            draggableHandle=".drag-handle"
          >
          {filteredLayout.map((item) => {
            const widget = availableWidgets.find(w => w.id === item.i);
            return (
              <div 
                key={item.i} 
                className={`${isEditMode ? 'ring-2 ring-primary/50 rounded-lg' : ''}`}
                role="region"
                aria-label={`${widget?.name || item.i} widget`}
              >
                {isEditMode && (
                  <div className="drag-handle absolute top-2 left-2 right-2 h-8 bg-primary/10 rounded-t-lg cursor-move flex items-center justify-center z-10">
                    <span className="text-xs font-medium text-primary">Drag to move</span>
                  </div>
                )}
                <div className={`h-full ${isEditMode ? 'pt-10' : ''}`}>
                  {renderWidget(item.i)}
                </div>
              </div>
            );
          })}
          </GridLayout>
        </div>
      </div>
    </>
  );
};
