import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { exportToCSV } from "@/utils/chartExport";
import { Download, TrendingUp, AlertTriangle } from "lucide-react";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { toast } from "sonner";
import { useChartHeight } from "@/components/ui/adaptive-chart";
import { useIsMobile } from "@/hooks/use-mobile";

export const PriceUtilizationScatterPlot = () => {
  const { vehicles, applyPriceOptimization } = useLocationFilteredFleet();
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showOptimization, setShowOptimization] = useState(false);
  
  const isMobile = useIsMobile();
  const chartHeight = useChartHeight(220, 260, 300);

  // Transform vehicle data for scatter plot
  const allData = vehicles
    .filter(v => v.name !== 'Lotus Evija')
    .map(vehicle => {
      const utilization = vehicle.utilization || 0;
      const dailyRate = Number(vehicle.current_rate);
      const suggestedRate = Number(vehicle.suggested_rate || dailyRate);
      
      let zone = 'balanced';
      if (utilization > 70 && dailyRate < 400) zone = 'underpriced';
      else if (utilization < 50 && dailyRate > 450) zone = 'overpriced';
      else if (utilization > 70 && dailyRate > 450) zone = 'optimal';
      
      return {
        name: vehicle.name,
        utilization,
        dailyRate,
        suggestedRate,
        zone,
        vehicleData: vehicle
      };
    });

  // Apply zone filter
  const data = zoneFilter === 'all' 
    ? allData 
    : allData.filter(d => d.zone === zoneFilter);

  const handleExportCSV = () => {
    const exportData = allData.map(d => ({
      Vehicle: d.name,
      'Utilization %': d.utilization,
      'Daily Rate': d.dailyRate,
      'Suggested Rate': d.suggestedRate,
      Zone: d.zone,
      Revenue: d.vehicleData.revenue || 0
    }));
    
    exportToCSV(exportData, 'price_utilization_data');
    
    toast("Export Successful", { description: "Price & utilization data has been exported to CSV" });
  };

  const handlePointClick = (data: any) => {
    if (data && data.vehicleData) {
      setSelectedVehicle(data.vehicleData);
      setShowOptimization(true);
    }
  };

  const zones = [
    { value: 'all', label: 'All Zones', count: allData.length },
    { value: 'underpriced', label: 'Underpriced', count: allData.filter(d => d.zone === 'underpriced').length, icon: TrendingUp },
    { value: 'overpriced', label: 'Overpriced', count: allData.filter(d => d.zone === 'overpriced').length, icon: AlertTriangle },
    { value: 'optimal', label: 'Optimal', count: allData.filter(d => d.zone === 'optimal').length },
    { value: 'balanced', label: 'Balanced', count: allData.filter(d => d.zone === 'balanced').length }
  ];

  const getZoneColor = (zone: string) => {
    switch (zone) {
      case 'optimal': return 'hsl(var(--success))';
      case 'overpriced': return 'hsl(var(--destructive))';
      case 'underpriced': return 'hsl(var(--warning))';
      default: return 'hsl(var(--primary))';
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const priceDiff = dataPoint.suggestedRate - dataPoint.dailyRate;
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-semibold mb-2">{dataPoint.name}</p>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Utilization: {dataPoint.utilization}%</p>
            <p className="text-muted-foreground">Daily Rate: ${dataPoint.dailyRate}</p>
            {Math.abs(priceDiff) > 5 && (
              <p className="text-primary font-medium">
                AI suggests: ${dataPoint.suggestedRate} 
                {priceDiff > 0 ? ` (+$${priceDiff.toFixed(0)})` : ` ($${priceDiff.toFixed(0)})`}
              </p>
            )}
          </div>
          <Badge className={`mt-2 ${
            dataPoint.zone === 'optimal' ? 'bg-success/20 text-success border-success/30' :
            dataPoint.zone === 'overpriced' ? 'bg-destructive/20 text-destructive border-destructive/30' :
            dataPoint.zone === 'underpriced' ? 'bg-warning/20 text-warning border-warning/30' :
            'bg-primary/20 text-primary border-primary/30'
          }`}>
            {dataPoint.zone === 'optimal' ? 'Sweet Spot' :
             dataPoint.zone === 'overpriced' ? 'Overpriced' :
             dataPoint.zone === 'underpriced' ? 'Underpriced' : 'Balanced'}
          </Badge>
          
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {selectedVehicle && (
        <PriceOptimizationDialog
          open={showOptimization}
          onOpenChange={setShowOptimization}
          vehicles={[selectedVehicle]}
          onApply={applyPriceOptimization}
        />
      )}
      
      <Card className="p-4 sm:p-6 border-2 border-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-1">Price vs. Utilization</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Fleet pricing distribution by zone
            </p>
          </div>
          {!isMobile && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
          {zones.map(zone => (
            <Badge
              key={zone.value}
              variant={zoneFilter === zone.value ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/20 transition-colors text-xs"
              onClick={() => setZoneFilter(zone.value)}
            >
              {zone.icon && <zone.icon className="h-3 w-3 mr-1" />}
              {isMobile ? zone.label.slice(0, 5) : zone.label} ({zone.count})
            </Badge>
          ))}
        </div>

        <div role="img" aria-label="Scatter plot showing price vs utilization">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ScatterChart onClick={handlePointClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number" 
                dataKey="utilization" 
                name="Utilization" 
                unit="%"
                domain={[0, 100]}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 10 : 12 }}
              />
              <YAxis 
                type="number" 
                dataKey="dailyRate" 
                name="Daily Rate" 
                unit="$"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 10 : 12 }}
                width={isMobile ? 40 : 50}
              />
              <ZAxis range={isMobile ? [60, 200] : [100, 400]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter 
                data={data} 
                fill="hsl(var(--primary))"
                style={{ cursor: 'pointer' }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getZoneColor(entry.zone)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Sweet Spot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Underpriced</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground">Overpriced</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Balanced</span>
          </div>
        </div>

        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Insight:</strong> Vehicles in the green zone (top-right) are optimally priced. 
            Orange zone vehicles (top-left) have high demand but low rates - consider increasing prices.
            Red zone vehicles (bottom-right) may need price adjustments to improve utilization.
          </p>
        </div>
      </Card>
    </>
  );
};
