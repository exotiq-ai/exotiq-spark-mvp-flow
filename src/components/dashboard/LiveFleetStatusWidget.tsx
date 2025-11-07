import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, ArrowRight } from "lucide-react";
import { useFleet } from "@/contexts/FleetContext";

interface LiveFleetStatusWidgetProps {
  onViewAll: () => void;
}

export const LiveFleetStatusWidget = ({ onViewAll }: LiveFleetStatusWidgetProps) => {
  const { vehicles } = useFleet();
  
  // Calculate status counts
  const available = vehicles.filter(v => v.status === 'available').length;
  const booked = vehicles.filter(v => v.status === 'booked').length;
  const maintenance = vehicles.filter(v => v.status === 'maintenance').length;
  
  return (
    <Card className="p-6 border-2 border-border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Live Fleet Status</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View All
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium">Available</span>
          </div>
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            {available}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm font-medium">Booked</span>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {booked}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-sm font-medium">Maintenance</span>
          </div>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            {maintenance}
          </Badge>
        </div>
      </div>
    </Card>
  );
};
