import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const DemandForecastCard = () => {
  // Simulated 7-day forecast data
  const forecastData = [
    { day: "Mon", demand: 72, trend: "up" },
    { day: "Tue", demand: 68, trend: "down" },
    { day: "Wed", demand: 75, trend: "up" },
    { day: "Thu", demand: 82, trend: "up" },
    { day: "Fri", demand: 95, trend: "up" },
    { day: "Sat", demand: 98, trend: "up" },
    { day: "Sun", demand: 88, trend: "down" },
  ];

  const avgDemand = Math.round(forecastData.reduce((sum, d) => sum + d.demand, 0) / forecastData.length);
  const peakDay = forecastData.reduce((max, d) => d.demand > max.demand ? d : max, forecastData[0]);

  return (
    <Card className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-accent/20 to-primary/20 rounded-xl">
            <TrendingUp className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Demand Forecast</h3>
            <p className="text-sm text-muted-foreground">7-day rental demand prediction</p>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Powered
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Predictions based on historical booking patterns</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Forecast Visualization */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {forecastData.map((day, index) => {
          const height = (day.demand / 100) * 100;
          const isToday = index === 0;
          const isPeak = day.demand === peakDay.demand;
          
          return (
            <div key={day.day} className="flex flex-col items-center gap-2">
              <div className="text-xs text-muted-foreground">{day.demand}%</div>
              <div className="relative w-full h-24 bg-muted/30 rounded-lg overflow-hidden">
                <div
                  className={`absolute bottom-0 w-full rounded-lg transition-all ${
                    isPeak 
                      ? "bg-gradient-to-t from-success to-success/50" 
                      : day.demand >= 80 
                        ? "bg-gradient-to-t from-warning to-warning/50"
                        : "bg-gradient-to-t from-primary to-primary/50"
                  }`}
                  style={{ height: `${height}%` }}
                />
                {isPeak && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2">
                    <TrendingUp className="h-3 w-3 text-success" />
                  </div>
                )}
              </div>
              <div className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {isToday ? "Today" : day.day}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="text-sm text-muted-foreground mb-1">Avg Demand</div>
          <div className="text-2xl font-bold">{avgDemand}%</div>
          <div className="flex items-center gap-1 text-xs text-success">
            <TrendingUp className="h-3 w-3" />
            +5% vs last week
          </div>
        </div>
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <div className="text-sm text-muted-foreground mb-1">Peak Day</div>
          <div className="text-2xl font-bold text-success">{peakDay.day}</div>
          <div className="text-xs text-muted-foreground">{peakDay.demand}% expected demand</div>
        </div>
      </div>

      {/* Event Calendar Integration - Coming Soon */}
      <div className="p-4 rounded-lg border border-dashed bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Event Calendar Integration</div>
              <div className="text-sm text-muted-foreground">
                Cross-reference local events for demand spikes
              </div>
            </div>
          </div>
          <Badge variant="outline" className="bg-muted/50">
            Coming Soon
          </Badge>
        </div>
        <div className="mt-3 p-3 rounded bg-muted/30 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              Planned integration with PredictHQ for real-time event data including concerts, 
              sports events, conferences, and holidays that impact rental demand.
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
