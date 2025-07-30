import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3,
  Zap,
  Target,
  ArrowRight
} from "lucide-react";

export const MotorIQ = () => {
  const profitabilityData = [
    { vehicle: "McLaren 720S", revenue: "$4,200", margin: "+18%", trend: "up" },
    { vehicle: "Lamborghini Huracán", revenue: "$3,800", margin: "+22%", trend: "up" },
    { vehicle: "Ferrari 488", revenue: "$4,500", margin: "+15%", trend: "up" },
    { vehicle: "Porsche 911 GT3", revenue: "$2,900", margin: "+12%", trend: "down" }
  ];

  const recommendations = [
    {
      title: "Increase McLaren 720S pricing",
      impact: "+$380/week",
      confidence: "95%",
      action: "Raise daily rate by $50"
    },
    {
      title: "Optimize Huracán availability",
      impact: "+$220/week", 
      confidence: "87%",
      action: "Block Thu-Sun for premium rates"
    },
    {
      title: "Bundle insurance with Ferrari",
      impact: "+$150/week",
      confidence: "78%",
      action: "Add comprehensive coverage option"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">MotorIQ</h2>
          <p className="text-muted-foreground mt-1">AI-powered fleet profitability optimization</p>
        </div>
        <Badge className="bg-success/10 text-success border-success/20">
          <Zap className="w-4 h-4 mr-1" />
          FleetCopilot™ AI Active
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="card-premium p-6">
          <div className="flex items-center">
            <div className="p-2 bg-success/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-success">+$1,150</div>
              <div className="text-sm text-muted-foreground">Weekly Impact</div>
            </div>
          </div>
        </Card>
        
        <Card className="card-premium p-6">
          <div className="flex items-center">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-primary">94%</div>
              <div className="text-sm text-muted-foreground">Accuracy</div>
            </div>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center">
            <div className="p-2 bg-accent/10 rounded-lg">
              <BarChart3 className="h-6 w-6 text-accent" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-accent">17%</div>
              <div className="text-sm text-muted-foreground">Margin Increase</div>
            </div>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center">
            <div className="p-2 bg-warning/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-warning" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-warning">3</div>
              <div className="text-sm text-muted-foreground">Active Optimizations</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Vehicle Performance */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Vehicle Performance</h3>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>
        
        <div className="space-y-4">
          {profitabilityData.map((vehicle, index) => (
            <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {vehicle.vehicle.split(' ')[0][0]}
                  </span>
                </div>
                <div>
                  <div className="font-semibold">{vehicle.vehicle}</div>
                  <div className="text-sm text-muted-foreground">Weekly Revenue: {vehicle.revenue}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className={`font-semibold ${vehicle.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                    {vehicle.margin}
                  </div>
                  <div className="text-sm text-muted-foreground">Margin</div>
                </div>
                {vehicle.trend === 'up' ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Recommendations */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">AI Recommendations</h3>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            3 Active
          </Badge>
        </div>
        
        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <div key={index} className="p-4 rounded-lg bg-muted/30 border border-primary/20">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">{rec.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{rec.action}</p>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-success">{rec.impact}</span>
                    <span className="text-sm text-muted-foreground">Confidence: {rec.confidence}</span>
                  </div>
                </div>
                <Button size="sm" className="ml-4">
                  Apply
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};