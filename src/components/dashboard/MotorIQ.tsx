import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  DollarSign, 
  Car, 
  Plus, 
  Edit, 
  Brain,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

const MotorIQ = () => {
  const [selectedVehicle, setSelectedVehicle] = useState("all");

  const vehicles = [
    {
      id: 1,
      name: "Ferrari 488 GTB",
      dailyRate: 450,
      monthlyRevenue: 8100,
      monthlyExpenses: 1200,
      netProfit: 6900,
      utilization: 60,
      status: "active"
    },
    {
      id: 2,
      name: "Lamborghini Huracan",
      dailyRate: 520,
      monthlyRevenue: 12480,
      monthlyExpenses: 1800,
      netProfit: 10680,
      utilization: 80,
      status: "active"
    },
    {
      id: 3,
      name: "McLaren 720S",
      dailyRate: 380,
      monthlyRevenue: 4180,
      monthlyExpenses: 950,
      netProfit: 3230,
      utilization: 36,
      status: "idle"
    }
  ];

  const aiInsights = [
    {
      type: "pricing",
      title: "Price Optimization",
      message: "Increase Ferrari 488 rate to $485/day for 15% profit boost",
      confidence: 89,
      status: "pending"
    },
    {
      type: "maintenance",
      title: "Cost Reduction",
      message: "Bundle McLaren service with nearby shop for 20% savings",
      confidence: 76,
      status: "pending"
    }
  ];

  const totalStats = {
    totalRevenue: vehicles.reduce((sum, v) => sum + v.monthlyRevenue, 0),
    totalExpenses: vehicles.reduce((sum, v) => sum + v.monthlyExpenses, 0),
    totalProfit: vehicles.reduce((sum, v) => sum + v.netProfit, 0),
    avgUtilization: vehicles.reduce((sum, v) => sum + v.utilization, 0) / vehicles.length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">MotorIQ</h1>
          <p className="text-muted-foreground">Fleet Profitability Engine</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
          <Button className="btn-premium">
            <Brain className="h-4 w-4 mr-2" />
            AI Optimize
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-success" />
            <Badge className="metric-positive">+12%</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">${totalStats.totalRevenue.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total Revenue</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-warning" />
            <Badge variant="outline">${totalStats.totalExpenses.toLocaleString()}</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">${totalStats.totalProfit.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Net Profit</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Car className="h-5 w-5 text-primary" />
            <Badge>{totalStats.avgUtilization.toFixed(0)}%</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">{vehicles.length}</div>
          <div className="text-sm text-muted-foreground">Active Vehicles</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Brain className="h-5 w-5 text-accent" />
            <Badge className="bg-accent/10 text-accent">AI</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">2</div>
          <div className="text-sm text-muted-foreground">AI Recommendations</div>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="card-premium">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">AI-Powered Insights</h3>
          <Brain className="h-5 w-5 text-accent" />
        </div>
        <div className="space-y-4">
          {aiInsights.map((insight, index) => (
            <div key={index} className="p-4 rounded-lg bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-accent" />
                  <span className="font-medium text-sm">{insight.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {insight.confidence}% confidence
                  </Badge>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="default">Accept</Button>
                  <Button size="sm" variant="outline">Dismiss</Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{insight.message}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Vehicle Performance Table */}
      <Card className="card-premium">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Vehicle Performance</h3>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit Expenses
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 font-medium">Vehicle</th>
                <th className="text-left py-3 font-medium">Daily Rate</th>
                <th className="text-left py-3 font-medium">Revenue</th>
                <th className="text-left py-3 font-medium">Expenses</th>
                <th className="text-left py-3 font-medium">Net Profit</th>
                <th className="text-left py-3 font-medium">Utilization</th>
                <th className="text-left py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-border/50">
                  <td className="py-4">
                    <div className="flex items-center space-x-3">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{vehicle.name}</span>
                    </div>
                  </td>
                  <td className="py-4">${vehicle.dailyRate}/day</td>
                  <td className="py-4 metric-positive">${vehicle.monthlyRevenue.toLocaleString()}</td>
                  <td className="py-4 metric-negative">${vehicle.monthlyExpenses.toLocaleString()}</td>
                  <td className="py-4">
                    <span className="font-bold text-primary">${vehicle.netProfit.toLocaleString()}</span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-12 h-2 rounded-full ${
                        vehicle.utilization >= 70 ? 'bg-success' :
                        vehicle.utilization >= 40 ? 'bg-warning' : 'bg-destructive'
                      }`}>
                        <div 
                          className="h-full bg-current rounded-full"
                          style={{ width: `${vehicle.utilization}%` }}
                        />
                      </div>
                      <span className="text-sm">{vehicle.utilization}%</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <Badge 
                      variant={vehicle.status === "active" ? "default" : "secondary"}
                      className={vehicle.status === "active" ? "bg-success text-success-foreground" : ""}
                    >
                      {vehicle.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Expense Entry */}
      <Card className="card-premium">
        <h3 className="text-lg font-semibold mb-4">Quick Expense Entry</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="vehicle">Vehicle</Label>
            <Input id="vehicle" placeholder="Select vehicle..." />
          </div>
          <div>
            <Label htmlFor="expense-type">Type</Label>
            <Input id="expense-type" placeholder="Maintenance, Fuel..." />
          </div>
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" placeholder="0.00" />
          </div>
          <div className="flex items-end">
            <Button className="w-full">Add Expense</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MotorIQ;