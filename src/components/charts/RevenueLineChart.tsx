import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Line, ReferenceArea } from "recharts";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useChartData, getRangeBounds, type ChartRange } from "@/hooks/useChartData";
import { RevenueBreakdownDialog } from "@/components/dialogs/RevenueBreakdownDialog";
import { exportToCSV } from "@/utils/chartExport";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useChartHeight, getResponsiveAxisConfig, formatCompactNumber } from "@/components/ui/adaptive-chart";
import { TouchTooltip, getTouchActiveDot } from "@/components/ui/touch-tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMoney } from "@/hooks/useMoney";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const RANGE_OPTIONS: { key: ChartRange; label: string }[] = [
  { key: "7D", label: "7D" },
  { key: "30D", label: "30D" },
  { key: "MTD", label: "MTD" },
  { key: "QTD", label: "QTD" },
  { key: "YTD", label: "YTD" },
];

export const RevenueLineChart = () => {
  const { bookings, vehicles, payments } = useLocationFilteredFleet();
  const [range, setRange] = useState<ChartRange>("30D");
  const { revenueData, collectedData } = useChartData(bookings, payments, range);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { money, currency, locale } = useMoney();
  const [selectedDay, setSelectedDay] = useState<typeof revenueData[0] | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [comparePeriod, setComparePeriod] = useState(false);
  const [showMovingAvg, setShowMovingAvg] = useState(true);
  const [viewMode, setViewMode] = useState<'booked' | 'collected'>('booked');
  const [isAnimated, setIsAnimated] = useState(false);

  const isMobile = useIsMobile();
  const chartHeight = useChartHeight(160, 200, 240);
  const axisConfig = getResponsiveAxisConfig(isMobile);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleExportCSV = () => {
    const exportData = (viewMode === 'booked' ? revenueData : collectedData).map(d => ({
      Date: d.fullDate,
      Revenue: d.revenue,
      MovingAvg7d: Math.round(d.movingAvg),
      PriorPeriodRevenue: d.previousRevenue,
      Bookings: d.bookingsCount,
    }));
    exportToCSV(exportData, `revenue_${viewMode}_${range}`);
    toast({ title: "Export ready", description: "Revenue data downloaded as CSV" });
  };

  const handlePointClick = (data: any) => {
    if (!data || !data.activePayload?.[0]?.payload) return;
    const payload = data.activePayload[0].payload;
    const dayData = (viewMode === 'booked' ? revenueData : collectedData).find(d => d.fullDate === payload.fullDate);
    if (dayData) {
      setSelectedDay(dayData);
      setShowBreakdown(true);
    }
  };

  const activeData = viewMode === 'booked' ? revenueData : collectedData;
  const chartColor = viewMode === 'booked' ? 'hsl(var(--success))' : 'hsl(var(--primary))';
  const chartLabel = viewMode === 'booked' ? 'Booked Revenue' : 'Collected Revenue';

  const totalRevenue = activeData.reduce((sum, d) => sum + d.revenue, 0);
  const priorTotal = activeData.reduce((sum, d) => sum + d.previousRevenue, 0);
  const avgRevenue = activeData.length > 0 ? totalRevenue / activeData.length : 0;
  const deltaPct = priorTotal > 0 ? Math.round(((totalRevenue - priorTotal) / priorTotal) * 100) : null;
  const hasData = totalRevenue > 0;

  const animatedData = isAnimated
    ? activeData
    : activeData.map(d => ({ ...d, revenue: 0, previousRevenue: 0, movingAvg: 0 }));

  // Weekend bands
  const weekendBands = useMemo(() => {
    const bands: { start: string; end: string }[] = [];
    let currentStart: string | null = null;
    activeData.forEach((d, i) => {
      if (d.isWeekend && currentStart === null) currentStart = d.date;
      const isLast = i === activeData.length - 1;
      const next = activeData[i + 1];
      if (currentStart !== null && (!d.isWeekend || isLast || !next?.isWeekend)) {
        bands.push({ start: currentStart, end: d.date });
        currentStart = null;
      }
    });
    return bands;
  }, [activeData]);

  const compactMoney = (v: number) => {
    if (Math.abs(v) >= 1000) {
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v);
      } catch {
        return money(v);
      }
    }
    return money(v);
  };

  const jumpToPayments = () => {
    const { start, end } = getRangeBounds(range);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    navigate(`/dashboard/payments?from=${fmt(start)}&to=${fmt(end)}`);
  };

  return (
    <TooltipProvider delayDuration={200}>
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
          aria-label={`Revenue trend chart for ${range}`}
        >
          <motion.div
            className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-semibold">Revenue Trend</h3>
                {deltaPct !== null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      deltaPct >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}
                    title={`${chartLabel} vs prior ${range}`}
                  >
                    {deltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {deltaPct >= 0 ? '+' : ''}{deltaPct}% vs prior {range}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {isMobile ? 'Tap a point for a day breakdown' : `Click any point for details · click "See in Payments" to open the ledger`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Range switcher */}
              <div className="inline-flex rounded-md border border-border p-0.5">
                {RANGE_OPTIONS.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={`px-2 py-1 text-xs rounded-sm transition-colors ${
                      range === r.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* View toggles */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={viewMode === 'booked' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                  onClick={() => setViewMode('booked')}
                >
                  Booked
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Contract value of reservations starting each day (confirmed + completed).</TooltipContent>
            </UITooltip>
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={viewMode === 'collected' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                  onClick={() => setViewMode('collected')}
                >
                  Collected
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Cash actually received on that day (from payment records).</TooltipContent>
            </UITooltip>
            <Badge
              variant={comparePeriod ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
              onClick={() => setComparePeriod(!comparePeriod)}
            >
              Compare
            </Badge>
            <Badge
              variant={showMovingAvg ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
              onClick={() => setShowMovingAvg(!showMovingAvg)}
            >
              7-day avg
            </Badge>
            {!isMobile && (
              <>
                <Button size="sm" variant="ghost" onClick={jumpToPayments} className="text-xs h-7">
                  See in Payments →
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-2 h-7">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </>
            )}
          </div>

          <motion.div
            className="grid grid-cols-2 gap-2 sm:gap-4 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Range Total ({range})</p>
              <motion.p
                className="text-lg sm:text-2xl font-bold text-primary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {isMobile ? compactMoney(totalRevenue) : money(totalRevenue)}
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
                {isMobile ? compactMoney(avgRevenue) : money(Math.round(avgRevenue))}
              </motion.p>
            </div>
          </motion.div>

          {hasData ? (
            <motion.div
              role="img"
              aria-label={`${chartLabel} area chart over ${range}`}
              className="cursor-pointer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={animatedData} onClick={handlePointClick}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                      <stop offset="50%" stopColor={chartColor} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  {weekendBands.map((b, i) => (
                    <ReferenceArea
                      key={`we-${i}`}
                      x1={b.start}
                      x2={b.end}
                      fill="hsl(var(--muted))"
                      fillOpacity={0.35}
                      strokeOpacity={0}
                      ifOverflow="visible"
                    />
                  ))}
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    {...axisConfig.xAxis}
                    interval="preserveStartEnd"
                    minTickGap={isMobile ? 30 : 20}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    {...axisConfig.yAxis}
                    tickFormatter={(value) => compactMoney(value)}
                  />
                  <Tooltip
                    content={<TouchTooltip formatter={(value: number) => [money(value), chartLabel]} />}
                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={chartColor}
                    strokeWidth={isMobile ? 2 : 2.5}
                    fill="url(#revenueGradient)"
                    style={{ cursor: 'pointer' }}
                    animationDuration={1500}
                    animationEasing="ease-out"
                    dot={false}
                    activeDot={getTouchActiveDot(chartColor)}
                  />
                  {showMovingAvg && (
                    <Line
                      type="monotone"
                      dataKey="movingAvg"
                      stroke={chartColor}
                      strokeOpacity={0.85}
                      strokeWidth={isMobile ? 1.25 : 1.5}
                      strokeDasharray="2 3"
                      dot={false}
                      animationDuration={1200}
                    />
                  )}
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
          ) : (
            <div
              className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border bg-muted/20 py-10 px-6"
              style={{ height: chartHeight }}
            >
              <p className="text-sm font-medium text-foreground mb-1">No revenue in this window yet</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {viewMode === 'booked'
                  ? 'Revenue appears here once a reservation starts inside this range.'
                  : 'Cash appears here once a payment is recorded in this range.'}
              </p>
            </div>
          )}
        </Card>
      </motion.div>
    </TooltipProvider>
  );
};

// Silence unused import lint if formatCompactNumber later unused
export const __unused = formatCompactNumber;
