import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFleet } from "@/contexts/FleetContext";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Car,
  Zap,
  ArrowRight,
  Sparkles,
  Activity
} from "lucide-react";

interface Module {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
}

interface DashboardOverviewProps {
  modules: Module[];
  onModuleClick: (moduleId: string) => void;
}

export const DashboardOverview = ({ modules, onModuleClick }: DashboardOverviewProps) => {
  const { revenue, vehicles, applyPriceOptimization } = useFleet();
  const { toast } = useToast();
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  
  const suggestedVehicle = vehicles.find(v => v.suggested_rate);

  return (
    <>
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehicles}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />
    <div className="space-y-6">
      {/* Dashboard Banner */}
      <DashboardBanner />

      {/* Hero Metric */}
      <Card className="p-8 border-2 border-border shadow-sm hover:shadow-md transition-all">
        <div className="flex items-start justify-between mb-8">
          <div>
            <Badge className="bg-success text-success-foreground border-transparent mb-4 shadow-sm relative">
              <Activity className="w-3 h-3 mr-1 animate-pulse" />
              System Live
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-pulse" />
            </Badge>
            <h2 className="text-6xl font-bold mb-2">${revenue.month.toLocaleString()}</h2>
            <p className="text-xl text-muted-foreground">Total Revenue This Month</p>
          </div>
          <div className="text-right">
            <div className="flex items-center text-success text-3xl font-semibold mb-2">
              <TrendingUp className="w-8 h-8 mr-2" />
              +{revenue.change}%
            </div>
            <p className="text-sm text-muted-foreground">vs last month</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-background border-2 border-border rounded-xl p-4 hover:border-success/50 transition-all group cursor-pointer">
            <DollarSign className="h-6 w-6 text-success mb-3" />
            <div className="text-2xl font-bold">${revenue.today.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground mt-1">Today</div>
            <div className="h-1 w-full bg-muted rounded-full mt-3 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-full bg-success rounded-full animate-fade-in" style={{ width: '67%' }} />
            </div>
          </div>
          <div className="bg-background border-2 border-border rounded-xl p-4 hover:border-primary/50 transition-all group cursor-pointer">
            <Calendar className="h-6 w-6 text-primary mb-3" />
            <div className="text-2xl font-bold">18</div>
            <div className="text-sm text-muted-foreground mt-1">Active Bookings</div>
            <div className="h-1 w-full bg-muted rounded-full mt-3 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-full bg-primary rounded-full animate-fade-in" style={{ width: '72%' }} />
            </div>
          </div>
          <div className="bg-background border-2 border-border rounded-xl p-4 hover:border-accent/50 transition-all group cursor-pointer">
            <Car className="h-6 w-6 text-accent mb-3" />
            <div className="text-2xl font-bold">78%</div>
            <div className="text-sm text-muted-foreground mt-1">Utilization</div>
            <div className="h-1 w-full bg-muted rounded-full mt-3 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-full bg-accent rounded-full animate-fade-in" style={{ width: '78%' }} />
            </div>
          </div>
          <div className="bg-background border-2 border-border rounded-xl p-4 hover:border-warning/50 transition-all group cursor-pointer">
            <TrendingUp className="h-6 w-6 text-warning mb-3" />
            <div className="text-2xl font-bold">$342</div>
            <div className="text-sm text-muted-foreground mt-1">Avg Rate</div>
            <div className="h-1 w-full bg-muted rounded-full mt-3 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-full bg-warning rounded-full animate-fade-in" style={{ width: '85%' }} />
            </div>
          </div>
        </div>
      </Card>

      {/* AI Insight Widget */}
      <Card className="p-6 border-2 border-accent/30 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-accent/10 border-2 border-accent/30 rounded-xl">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold">FleetCopilot™ Recommendation</h3>
              <Badge className="bg-success text-success-foreground border-transparent shadow-sm">
                +$2,250/mo potential
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">
              Consider increasing the rate for your Ferrari 488 by 15% for weekend bookings. 
              Market demand shows 89% probability of maintaining bookings at this price point.
            </p>
            <div className="flex space-x-3">
              <Button 
                className="hover-scale"
                onClick={() => setShowOptimizationDialog(true)}
              >
                <Zap className="w-4 h-4 mr-2" />
                Apply Optimization
              </Button>
              <Button 
                variant="outline" 
                className="hover-scale"
                onClick={() => onModuleClick('motoriq')}
              >
                View Analysis
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          <Card 
            key={module.id} 
            className="p-6 border-2 border-border hover:border-primary/50 shadow-sm hover:shadow-md transition-all cursor-pointer focus-visible transform hover:-translate-y-1"
            onClick={() => onModuleClick(module.id)}
            tabIndex={0}
            role="button"
            aria-label={`Open ${module.name} - ${module.description}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onModuleClick(module.id);
              }
            }}
          >
            <div className={`p-4 rounded-xl border-2 ${module.color.replace('text-', 'border-')} bg-background mb-4 w-fit`}>
              <module.icon className={`h-8 w-8 ${module.color}`} />
            </div>
            <h3 className="text-xl font-semibold mb-2">{module.name}</h3>
            <p className="text-muted-foreground mb-4">{module.description}</p>
            <Button variant="outline" className="w-full">
              Open Module
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
    </>
  );
};
