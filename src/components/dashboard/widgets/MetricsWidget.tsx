import { Card } from "@/components/ui/card";
import { MiniSparkline } from "@/components/charts/MiniSparkline";
import { Calendar, Car, BarChart3, TrendingUp } from "lucide-react";

export const MetricsWidget = () => {
  const bookingsSparkline = [12, 15, 13, 18, 16, 17, 18];
  const utilizationSparkline = [72, 75, 78, 76, 79, 77, 78];
  const rateSparkline = [320, 330, 325, 342, 338, 340, 342];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
      <Card 
        className="p-4 md:p-6 border-2 border-border hover:border-primary/50 transition-all touch-target"
        role="article"
        aria-label="Active Bookings Metric"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Calendar className="h-5 w-5 md:h-6 md:w-6 text-primary" aria-hidden="true" />
          </div>
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
        </div>
        <div className="text-2xl md:text-3xl font-bold mb-1" aria-label="18 active bookings">18</div>
        <div className="text-xs md:text-sm text-muted-foreground mb-3">Active Bookings</div>
        <MiniSparkline data={bookingsSparkline} color="hsl(var(--primary))" aria-label="Bookings trend chart" />
        <div className="sr-only">
          Bookings trend data: {bookingsSparkline.join(', ')} bookings over 7 days
        </div>
      </Card>

      <Card 
        className="p-4 md:p-6 border-2 border-border hover:border-primary/50 transition-all touch-target"
        role="article"
        aria-label="Fleet Utilization Metric"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-success/10 rounded-xl">
            <Car className="h-5 w-5 md:h-6 md:w-6 text-success" aria-hidden="true" />
          </div>
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
        </div>
        <div className="text-2xl md:text-3xl font-bold mb-1" aria-label="78 percent fleet utilization">78%</div>
        <div className="text-xs md:text-sm text-muted-foreground mb-3">Fleet Utilization</div>
        <MiniSparkline data={utilizationSparkline} color="hsl(var(--success))" aria-label="Utilization trend chart" />
        <div className="sr-only">
          Utilization trend data: {utilizationSparkline.join(', ')} percent over 7 days
        </div>
      </Card>

      <Card 
        className="p-4 md:p-6 border-2 border-border hover:border-warning/50 transition-all touch-target"
        role="article"
        aria-label="Average Daily Rate Metric"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-warning/10 rounded-xl">
            <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-warning" aria-hidden="true" />
          </div>
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
        </div>
        <div className="text-2xl md:text-3xl font-bold mb-1" aria-label="342 dollars average daily rate">$342</div>
        <div className="text-xs md:text-sm text-muted-foreground mb-3">Average Daily Rate</div>
        <MiniSparkline data={rateSparkline} color="hsl(var(--warning))" aria-label="Rate trend chart" />
        <div className="sr-only">
          Daily rate trend data: {rateSparkline.map(r => `$${r}`).join(', ')} over 7 days
        </div>
      </Card>
    </div>
  );
};