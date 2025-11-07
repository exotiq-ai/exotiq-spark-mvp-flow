import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFleet } from "@/contexts/FleetContext";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { RevenueLineChart } from "@/components/charts/RevenueLineChart";
import { MiniSparkline } from "@/components/charts/MiniSparkline";
import { LiveFleetStatusWidget } from "@/components/dashboard/LiveFleetStatusWidget";
import { UpcomingScheduleWidget } from "@/components/dashboard/UpcomingScheduleWidget";
import { AskRariButton } from "@/components/common/AskRariButton";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar,
  Car,
  Zap,
  ArrowRight,
  Sparkles,
  TrendingUp,
  BarChart3
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
  
  // Generate mock sparkline data (7 days)
  const bookingsSparkline = [12, 15, 13, 18, 16, 17, 18];
  const utilizationSparkline = [72, 75, 78, 76, 79, 77, 78];
  const rateSparkline = [320, 330, 325, 342, 338, 340, 342];

  return (
    <>
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehicles}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />
    <div className="space-y-6">
      {/* Ask Rari Inline Button for Dashboard Overview */}
      <div className="flex justify-end">
        <AskRariButton 
          moduleId="dashboard" 
          moduleName="Dashboard"
          contextPrompt="Ask me anything about your fleet operations, performance metrics, or general insights."
          variant="inline"
        />
      </div>
      
      {/* Dashboard Banner */}
      <DashboardBanner />

      {/* Revenue Chart */}
      <RevenueLineChart />

      {/* Simplified 3-Column Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 border-2 border-border hover:border-primary/50 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div className="text-3xl font-bold mb-1">18</div>
          <div className="text-sm text-muted-foreground mb-3">Active Bookings</div>
          <MiniSparkline data={bookingsSparkline} color="hsl(var(--primary))" />
        </Card>

        <Card className="p-6 border-2 border-border hover:border-primary/50 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-success/10 rounded-xl">
              <Car className="h-6 w-6 text-success" />
            </div>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div className="text-3xl font-bold mb-1">78%</div>
          <div className="text-sm text-muted-foreground mb-3">Fleet Utilization</div>
          <MiniSparkline data={utilizationSparkline} color="hsl(var(--success))" />
        </Card>

        <Card className="p-6 border-2 border-border hover:border-warning/50 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-warning/10 rounded-xl">
              <BarChart3 className="h-6 w-6 text-warning" />
            </div>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div className="text-3xl font-bold mb-1">$342</div>
          <div className="text-sm text-muted-foreground mb-3">Average Daily Rate</div>
          <MiniSparkline data={rateSparkline} color="hsl(var(--warning))" />
        </Card>
      </div>

      {/* Enhanced AI Insight Widget */}
      <Card className="p-8 border-2 border-accent/30 shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-background to-accent/5">
        <div className="flex items-start space-x-6">
          <div className="p-4 bg-accent/10 border-2 border-accent/30 rounded-2xl">
            <Sparkles className="h-10 w-10 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-2xl font-semibold mb-1">FleetCopilot™ Recommendation</h3>
                <p className="text-sm text-muted-foreground">AI-powered pricing insight</p>
              </div>
              <Badge className="bg-success text-success-foreground border-transparent shadow-sm text-base px-4 py-1">
                +$2,250/mo potential
              </Badge>
            </div>
            <p className="text-muted-foreground mb-6 text-base leading-relaxed">
              Consider increasing the rate for your Ferrari 488 by 15% for weekend bookings. 
              Market demand shows <span className="font-semibold text-foreground">89% probability</span> of maintaining bookings at this price point.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button 
                size="lg"
                className="hover-scale"
                onClick={() => setShowOptimizationDialog(true)}
              >
                <Zap className="w-4 h-4 mr-2" />
                Apply Optimization
              </Button>
              <Button 
                size="lg"
                variant="outline" 
                className="hover-scale"
                onClick={() => onModuleClick('motoriq')}
              >
                View Full Analysis
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg"
                variant="ghost"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* New Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LiveFleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
        <UpcomingScheduleWidget onViewCalendar={() => onModuleClick('book')} />
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          <Card 
            key={module.id} 
            className="p-6 border-2 border-border hover:border-primary/50 shadow-sm hover:shadow-md transition-all cursor-pointer transform hover:-translate-y-1"
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
            <div className={`p-4 rounded-xl border-2 ${
              module.color === 'text-primary' ? 'border-primary bg-primary/10' : 'border-secondary bg-secondary/10'
            } mb-4 w-fit`}>
              <module.icon className={`h-8 w-8 ${module.color}`} />
            </div>
            <h3 className="text-h3 mb-2">{module.name}</h3>
            <p className="text-small text-muted-foreground mb-4">{module.description}</p>
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
