import { CollapsibleSection } from "./CollapsibleSection";
import { DriverPerformanceTrend } from "@/components/charts/DriverPerformanceTrend";
import { Badge } from "@/components/ui/badge";
import { useDemo } from "@/contexts/DemoContext";
import { 
  User,
  Gauge,
  Plug
} from "lucide-react";

export const DriverTelematics = () => {
  // Only show this section for demo accounts
  let isDemo = false;
  try {
    const { demoState } = useDemo();
    isDemo = demoState.isDemo;
  } catch {
    // Not in demo context, don't show
    isDemo = false;
  }

  // Don't render for non-demo accounts
  if (!isDemo) return null;

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

  return (
    <CollapsibleSection
      id="telematics"
      title="Driver Telematics"
      icon={<Gauge className="h-4 w-4 text-primary" />}
      defaultOpen={true}
      actions={
        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground border-muted-foreground/30">
          <Plug className="w-2.5 h-2.5 mr-1" />
          API Soon
        </Badge>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {drivers.map((driver) => {
          const colors = getScoreColor(driver.score);
          
          return (
            <div 
              key={driver.id}
              className={`p-4 rounded-xl bg-gradient-to-br ${colors.gradient} border ${colors.border}`}
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
              
              {/* Compact progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full ${colors.bg} transition-all`} 
                  style={{ width: `${driver.score}%` }}
                />
              </div>
              
              {/* Compact stats */}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Driving: <span className="font-medium text-foreground">{driver.smoothDriving}</span>
                </span>
                <span className="text-muted-foreground">
                  Safety: <span className="font-medium text-foreground">{driver.safety}/100</span>
                </span>
              </div>
              
              {/* Mini trend chart */}
              <div className="mt-2">
                <DriverPerformanceTrend
                  driverName={driver.name}
                  currentScore={driver.score}
                  vehicle={driver.vehicle}
                  status={driver.status}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 p-2 bg-muted/30 rounded-lg text-xs text-muted-foreground text-center">
        💡 Connect your telematics provider for live data
      </div>
    </CollapsibleSection>
  );
};
