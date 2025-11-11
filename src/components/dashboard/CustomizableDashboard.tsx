import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import GridLayout, { Layout } from "react-grid-layout";
import { Edit3, Save, RotateCcw, Plus, X } from "lucide-react";
import { useDashboardLayout, availableWidgets } from "@/hooks/useDashboardLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { WidgetLibrary } from "./WidgetLibrary";
import { BannerWidget } from "./widgets/BannerWidget";
import { RevenueWidget } from "./widgets/RevenueWidget";
import { MetricsWidget } from "./widgets/MetricsWidget";
import { AIInsightWidget } from "./widgets/AIInsightWidget";
import { FleetStatusWidget } from "./widgets/FleetStatusWidget";
import { ScheduleWidget } from "./widgets/ScheduleWidget";
import { ModuleGridWidget } from "./widgets/ModuleGridWidget";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { useFleet } from "@/contexts/FleetContext";
import { AskRariButton } from "@/components/common/AskRariButton";
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { vehicles, applyPriceOptimization } = useFleet();
  const { layout, visibleWidgets, loading, saveLayout, resetLayout, toggleWidget, setLayout } = useDashboardLayout();

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
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
      'metrics': <MetricsWidget />,
      'ai-insight': <AIInsightWidget 
        onApplyOptimization={() => setShowOptimizationDialog(true)}
        onViewAnalysis={() => onModuleClick('motoriq')}
      />,
      'fleet-status': <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />,
      'schedule': <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />,
      'modules': <ModuleGridWidget modules={modules} onModuleClick={onModuleClick} />,
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
  
  // Mobile: force single column, full width for all widgets
  const mobileLayout = filteredLayout.map(item => ({
    ...item,
    x: 0,
    w: 12,
    static: !isEditMode
  }));

  const finalLayout = isMobile ? mobileLayout : filteredLayout;

  return (
    <>
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehicles}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />

      <div className="space-y-4 md:space-y-6" ref={containerRef}>
        {/* Customize Controls */}
        <div 
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border-2"
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
            <AskRariButton 
              moduleId="dashboard" 
              moduleName="Dashboard"
              contextPrompt="Ask me anything about your fleet operations, performance metrics, or general insights."
              variant="inline"
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
            className="p-4 bg-accent/10 border-2 border-accent/30 rounded-lg"
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
    </>
  );
};