import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFleet } from "@/contexts/FleetContext";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
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
      {/* Hero Metric */}
      <Card className="card-premium bg-gradient-to-br from-primary/10 via-accent/5 to-success/10 border-primary/20 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge className="bg-success/20 text-success border-success/30 mb-3">
              <Activity className="w-3 h-3 mr-1" />
              Live Today
            </Badge>
            <h2 className="text-6xl font-bold mb-2">${revenue.month.toLocaleString()}</h2>
            <p className="text-2xl text-muted-foreground">Total Revenue This Month</p>
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
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4">
            <DollarSign className="h-5 w-5 text-success mb-2" />
            <div className="text-2xl font-bold">${revenue.today.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Today</div>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4">
            <Calendar className="h-5 w-5 text-primary mb-2" />
            <div className="text-2xl font-bold">18</div>
            <div className="text-xs text-muted-foreground">Active Bookings</div>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4">
            <Car className="h-5 w-5 text-accent mb-2" />
            <div className="text-2xl font-bold">78%</div>
            <div className="text-xs text-muted-foreground">Utilization</div>
          </div>
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4">
            <TrendingUp className="h-5 w-5 text-warning mb-2" />
            <div className="text-2xl font-bold">$342</div>
            <div className="text-xs text-muted-foreground">Avg Rate</div>
          </div>
        </div>
      </Card>

      {/* AI Insight Widget */}
      <Card className="card-premium bg-gradient-to-br from-accent/10 to-primary/5 border-accent/20 p-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-accent/20 rounded-xl animate-pulse-glow">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold">FleetCopilot™ Recommendation</h3>
              <Badge className="bg-success/20 text-success border-success/30">
                +$2,250/mo potential
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">
              Consider increasing the rate for your Ferrari 488 by 15% for weekend bookings. 
              Market demand shows 89% probability of maintaining bookings at this price point.
            </p>
            <div className="flex space-x-3">
              <Button 
                className="btn-premium hover-scale"
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
            className="card-module cursor-pointer hover-scale focus-visible"
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
            <div className={`p-4 rounded-xl ${module.bgColor} mb-4 w-fit`}>
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
