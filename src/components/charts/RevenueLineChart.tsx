import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useFleet } from "@/contexts/FleetContext";
import { useChartData } from "@/hooks/useChartData";
import { RevenueBreakdownDialog } from "@/components/dialogs/RevenueBreakdownDialog";
import { exportToCSV } from "@/utils/chartExport";
import { Download, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const RevenueLineChart = () => {
  const { bookings, vehicles, payments } = useFleet();
  const { revenueData } = useChartData(bookings, payments);
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<typeof revenueData[0] | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [comparePeriod, setComparePeriod] = useState(false);

  const handleExportCSV = () => {
    const exportData = revenueData.map(d => ({
      Date: d.date,
      Revenue: d.revenue,
      Bookings: d.bookingsCount
    }));
    
    exportToCSV(exportData, 'revenue_data');
    
    toast({
      title: "Export Successful",
      description: "Revenue data has been exported to CSV",
    });
  };

  const handlePointClick = (data: any) => {
    const dayData = revenueData.find(d => d.date === data.date);
    if (dayData) {
      setSelectedDay(dayData);
      setShowBreakdown(true);
    }
  };

  // Generate comparison data (previous period)
  const comparisonData = comparePeriod ? revenueData.map((d, i) => ({
    ...d,
    previousRevenue: i > 0 ? revenueData[i - 1].revenue * 0.92 : 0 // Mock previous period
  })) : revenueData;

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const avgRevenue = totalRevenue / revenueData.length;

  return (
    <>
      {selectedDay && (
        <RevenueBreakdownDialog
          open={showBreakdown}
          onOpenChange={setShowBreakdown}
          date={selectedDay.date}
          revenue={selectedDay.revenue}
          bookings={selectedDay.bookings}
          vehicles={vehicles}
        />
      )}
      
      <Card 
        className="p-6 border-2 border-border shadow-sm"
        role="region"
        aria-label="Revenue trend chart for last 30 days"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Revenue Trend</h3>
            <p className="text-sm text-muted-foreground">Last 30 days • Click any point for details</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-primary/10"
              onClick={() => setComparePeriod(!comparePeriod)}
            >
              {comparePeriod ? 'Hide' : 'Show'} Comparison
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-primary">${totalRevenue.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Avg per Day</p>
            <p className="text-2xl font-bold">${Math.round(avgRevenue).toLocaleString()}</p>
          </div>
        </div>
      
        <div 
          role="img" 
          aria-label="Area chart showing daily revenue over the last 30 days, with weekend peaks visible"
          className="cursor-pointer"
        >
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={comparisonData} onClick={handlePointClick}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                interval="preserveStartEnd"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--success))" 
                strokeWidth={2}
                fill="url(#revenueGradient)"
                style={{ cursor: 'pointer' }}
              />
              {comparePeriod && (
                <Line
                  type="monotone"
                  dataKey="previousRevenue"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
};
