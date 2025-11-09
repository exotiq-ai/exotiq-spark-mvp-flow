import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Check } from "lucide-react";
import { availableWidgets } from "@/hooks/useDashboardLayout";

interface WidgetLibraryProps {
  visibleWidgets: string[];
  onToggleWidget: (widgetId: string) => void;
  onClose: () => void;
}

export const WidgetLibrary = ({ visibleWidgets, onToggleWidget, onClose }: WidgetLibraryProps) => {
  return (
    <Card 
      className="fixed top-20 right-4 w-80 max-h-[600px] z-50 shadow-2xl border-2"
      role="dialog"
      aria-labelledby="widget-library-title"
      aria-modal="true"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle id="widget-library-title">Widget Library</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="touch-target min-h-[44px] min-w-[44px]"
            aria-label="Close widget library"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Add or remove widgets from your dashboard</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {availableWidgets.map((widget) => {
              const isVisible = visibleWidgets.includes(widget.id);
              return (
                <div
                  key={widget.id}
                  className="flex items-center justify-between p-4 border-2 rounded-lg hover:border-primary/50 transition-all touch-target"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{widget.name}</h4>
                      {isVisible && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Size: {widget.defaultSize.w}x{widget.defaultSize.h}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isVisible ? "outline" : "default"}
                    onClick={() => onToggleWidget(widget.id)}
                    className="ml-2 touch-target min-h-[44px]"
                    aria-label={isVisible ? `Remove ${widget.name} widget` : `Add ${widget.name} widget`}
                  >
                    {isVisible ? (
                      <>
                        <X className="h-4 w-4 mr-1" aria-hidden="true" />
                        Remove
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};