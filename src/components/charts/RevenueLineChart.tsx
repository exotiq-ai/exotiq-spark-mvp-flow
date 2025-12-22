import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Line } from "recharts";
import { useFleet } from "@/contexts/FleetContext";
import { useChartData } from "@/hooks/useChartData";
import { RevenueBreakdownDialog } from "@/components/dialogs/RevenueBreakdownDialog";
import { exportToCSV } from "@/utils/chartExport";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useChartHeight, getResponsiveAxisConfig, formatCompactNumber } from "@/components/ui/adaptive-chart";
import { TouchTooltip, getTouchActiveDot } from "@/components/ui/touch-tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

export const RevenueLineChart = () => {
  const { bookings, vehicles, payments } = useFleet();
  const { revenueData } = useChartData(bookings, payments);
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<typeof revenueData[0] | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [comparePeriod, setComparePeriod] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  
  const isMobile = useIsMobile();
  const chartHeight = useChartHeight(160, 200, 240);
  const axisConfig = getResponsiveAxisConfig(isMobile);

  // Trigger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

  // Animated data - gradually reveal points
  const animatedData = isAnimated 
    ? comparisonData 
    : comparisonData.map(d => ({ ...d, revenue: 0, previousRevenue: 0 }));

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
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Card 
          className="p-6 border-2 border-border shadow-sm overflow-hidden"
          role="region"
          aria-label="Revenue trend chart for last 30 days"
        >
          <motion.div 
            className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div>
              <h3 className="text-lg sm:text-xl font-semibold mb-1">Revenue Trend</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isMobile ? 'Tap for details' : 'Last 30 days • Click any point for details'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                onClick={() => setComparePeriod(!comparePeriod)}
              >
                {comparePeriod ? 'Hide' : 'Compare'}
              </Badge>
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
          </motion.div>

          <motion.div 
            className="grid grid-cols-2 gap-2 sm:gap-4 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Total Revenue</p>
              <motion.p 
                className="text-lg sm:text-2xl font-bold text-primary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                ${isMobile ? formatCompactNumber(totalRevenue) : totalRevenue.toLocaleString()}
              </motion.p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Avg/Day</p>
              <motion.p 
                className="text-lg sm:text-2xl font-bold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                ${isMobile ? formatCompactNumber(Math.round(avgRevenue)) : Math.round(avgRevenue).toLocaleString()}
              </motion.p>
            </div>
          </motion.div>
        
          <motion.div 
            role="img" 
            aria-label="Area chart showing daily revenue over the last 30 days, with weekend peaks visible"
            className="cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <ResponsiveContainer width="100%" height={chartHeight}>
              <AreaChart data={animatedData} onClick={handlePointClick}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4}/>
                    <stop offset="50%" stopColor="hsl(var(--success))" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                  </linearGradient>
                  <filter id="chartGlow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  {...axisConfig.xAxis}
                  interval={isMobile ? 'preserveStartEnd' : 'preserveStartEnd'}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  {...axisConfig.yAxis}
                  tickFormatter={(value) => `$${formatCompactNumber(value)}`}
                />
                <Tooltip 
                  content={<TouchTooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />}
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={isMobile ? 2 : 2.5}
                  fill="url(#revenueGradient)"
                  style={{ cursor: 'pointer' }}
                  animationDuration={1500}
                  animationEasing="ease-out"
                  dot={false}
                  activeDot={getTouchActiveDot('hsl(var(--success))')}
                />
                {comparePeriod && (
                  <Line
                    type="monotone"
                    dataKey="previousRevenue"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={isMobile ? 1.5 : 2}
                    strokeDasharray="5 5"
                    dot={false}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </Card>
      </motion.div>
    </>
  );
};
