import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DriverPerformanceTrend } from "@/components/charts/DriverPerformanceTrend";
import { useDemo } from "@/contexts/DemoContext";
import { 
  User,
  Gauge,
  Plug
} from "lucide-react";

// Demo data for showcase purposes
const drivers = [
  {
    id: '1',
    name: 'Priya Sharma',
    vehicle: 'Ferrari SF90 Stradale',
    score: 98,
    status: 'excellent' as const,
    smoothDriving: 'Exceptional',
    safety: 99
  },
  {
    id: '2',
    name: 'Elena Rodriguez',
    vehicle: 'Porsche 911 Turbo S',
    score: 94,
    status: 'excellent' as const,
    smoothDriving: 'Excellent',
    safety: 96
  },
  {
    id: '3',
    name: 'Marcus Chen',
    vehicle: 'Lamborghini Huracán',
    score: 86,
    status: 'excellent' as const,
    smoothDriving: 'Excellent',
    safety: 89
  },
  {
    id: '4',
    name: 'James Wilson',
    vehicle: 'McLaren 720S',
    score: 81,
    status: 'excellent' as const,
    smoothDriving: 'Good',
    safety: 84
  },
  {
    id: '5',
    name: 'Aisha Thompson',
    vehicle: 'Bentley Continental GT',
    score: 92,
    status: 'excellent' as const,
    smoothDriving: 'Excellent',
    safety: 95
  },
  {
    id: '6',
    name: 'David Park',
    vehicle: 'Aston Martin DB12',
    score: 72,
    status: 'needs-improvement' as const,
    smoothDriving: 'Fair',
    safety: 78
  }
];

const getScoreColor = (score: number) => {
  if (score >= 80) return { text: 'text-success', bg: 'bg-success', border: 'border-success/20', gradient: 'from-success/10 to-success/5' };
  if (score >= 60) return { text: 'text-warning', bg: 'bg-warning', border: 'border-warning/20', gradient: 'from-warning/10 to-warning/5' };
  return { text: 'text-destructive', bg: 'bg-destructive', border: 'border-destructive/20', gradient: 'from-destructive/10 to-destructive/5' };
};

export const TelematicsTab = () => {
  // Check if demo account - use hook at top level
  const demoContext = useDemo();
  const isDemo = demoContext?.demoState?.isDemo ?? false;

  if (!isDemo) {
    return (
      <Card className="p-8 text-center border-2 border-dashed border-muted-foreground/20">
        <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
          <Gauge className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Telematics Integration</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Connect your telematics provider to see real-time driver behavior, safety scores, and live vehicle tracking.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mb-4">
          <Badge variant="secondary" className="text-xs">
            <Plug className="h-3 w-3 mr-1" />
            Zubie
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Plug className="h-3 w-3 mr-1" />
            Bouncie
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Plug className="h-3 w-3 mr-1" />
            Samsara
          </Badge>
        </div>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Coming Soon
        </Badge>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Gauge className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Driver Performance</h3>
            <p className="text-sm text-muted-foreground">Real-time telematics data</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
          <Plug className="w-3 h-3 mr-1" />
          Demo Data
        </Badge>
      </div>

      {/* Driver cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((driver) => {
          const colors = getScoreColor(driver.score);
          
          return (
            <Card 
              key={driver.id}
              className={`p-4 bg-gradient-to-br ${colors.gradient} border ${colors.border}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 ${colors.bg}/20 rounded-lg`}>
                    <User className={`h-4 w-4 ${colors.text}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{driver.name}</h4>
                    <p className="text-xs text-muted-foreground">{driver.vehicle}</p>
                  </div>
                </div>
                <div className={`text-xl font-bold ${colors.text}`}>
                  {driver.score}%
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full ${colors.bg} transition-all`} 
                  style={{ width: `${driver.score}%` }}
                />
              </div>
              
              {/* Stats */}
              <div className="flex justify-between text-xs mb-3">
                <span className="text-muted-foreground">
                  Driving: <span className="font-medium text-foreground">{driver.smoothDriving}</span>
                </span>
                <span className="text-muted-foreground">
                  Safety: <span className="font-medium text-foreground">{driver.safety}/100</span>
                </span>
              </div>
              
              {/* Mini trend chart */}
              <DriverPerformanceTrend
                driverName={driver.name}
                currentScore={driver.score}
                vehicle={driver.vehicle}
                status={driver.status}
              />
            </Card>
          );
        })}
      </div>

      {/* CTA */}
      <Card className="p-4 bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">
          💡 This is demo data. Connect your telematics provider for live tracking and driver behavior monitoring.
        </p>
      </Card>
    </div>
  );
};
