import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell } from "recharts";
import { useFleet } from "@/contexts/FleetContext";

export const PriceUtilizationScatterPlot = () => {
  const { vehicles } = useFleet();
  
  // Transform vehicle data for scatter plot
  const scatterData = vehicles
    .filter(v => v.name !== 'Lotus Evija')
    .map(vehicle => ({
      name: `${vehicle.make} ${vehicle.model}`,
      utilization: vehicle.utilization,
      dailyRate: vehicle.current_rate,
      // Determine pricing zone
      zone: vehicle.utilization >= 70 && vehicle.current_rate >= 300 ? 'optimal' :
            vehicle.utilization < 60 && vehicle.current_rate >= 350 ? 'overpriced' :
            vehicle.utilization >= 70 && vehicle.current_rate < 300 ? 'underpriced' : 'balanced',
      size: 100 // Uniform size for all points
    }));

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
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.name}</p>
          <p className="text-sm text-muted-foreground">Utilization: {data.utilization}%</p>
          <p className="text-sm text-muted-foreground">Daily Rate: ${data.dailyRate}</p>
          <Badge className={`mt-2 ${
            data.zone === 'optimal' ? 'bg-success/20 text-success' :
            data.zone === 'overpriced' ? 'bg-destructive/20 text-destructive' :
            data.zone === 'underpriced' ? 'bg-warning/20 text-warning' :
            'bg-primary/20 text-primary'
          }`}>
            {data.zone === 'optimal' ? 'Sweet Spot' :
             data.zone === 'overpriced' ? 'Overpriced' :
             data.zone === 'underpriced' ? 'Underpriced' : 'Balanced'}
          </Badge>
        </div>
      );
    }
    return null;
  };

  return (
    <Card 
      className="p-6 border-2 border-border shadow-sm"
      role="region"
      aria-label="Price versus utilization analysis chart"
    >
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Price vs Utilization Analysis</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Identify pricing opportunities by analyzing the relationship between vehicle utilization and daily rates
        </p>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-3" role="list" aria-label="Chart legend">
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-3 h-3 rounded-full bg-success" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Sweet Spot (High Util + Good Rate)</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-3 h-3 rounded-full bg-warning" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Underpriced (High Util + Low Rate)</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-3 h-3 rounded-full bg-destructive" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Overpriced (Low Util + High Rate)</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-3 h-3 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Balanced</span>
          </div>
        </div>
      </div>
      
      <div role="img" aria-label="Scatter plot showing the relationship between vehicle utilization percentage and daily rate in dollars. Vehicles are color-coded by pricing zone: green for optimal, orange for underpriced, red for overpriced, and blue for balanced.">
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            type="number" 
            dataKey="utilization" 
            name="Utilization"
            unit="%"
            domain={[0, 100]}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{ value: 'Utilization (%)', position: 'insideBottom', offset: -10, fill: 'hsl(var(--foreground))' }}
          />
          <YAxis 
            type="number" 
            dataKey="dailyRate" 
            name="Daily Rate"
            unit="$"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{ value: 'Daily Rate ($)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--foreground))' }}
          />
          <ZAxis type="number" dataKey="size" range={[100, 100]} />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Sweet spot zone overlay */}
          <rect x="70%" y="0" width="30%" height="50%" fill="hsl(var(--success))" opacity={0.05} />
          
          <Scatter name="Vehicles" data={scatterData}>
            {scatterData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getZoneColor(entry.zone)} />
            ))}
          </Scatter>
        </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 p-4 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Insight:</strong> Vehicles in the green zone (top-right) are optimally priced. 
          Orange zone vehicles (top-left) have high demand but low rates - consider increasing prices.
          Red zone vehicles (bottom-right) may need price adjustments to improve utilization.
        </p>
      </div>
    </Card>
  );
};
