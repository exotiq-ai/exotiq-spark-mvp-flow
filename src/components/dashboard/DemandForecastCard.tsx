import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  RefreshCw,
  MapPin,
  CalendarDays,
  Users,
  Music,
  Trophy,
  Building2,
  Filter,
  Tent,
  Theater,
  Star,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format, addDays } from "date-fns";

interface EventData {
  id: string;
  name: string;
  date: string;
  category: string;
  attendance: number;
  impactScore: number;
  labels?: string[];
}

// Luxury car rental hub cities - Miami as default for demo
const CITIES = [
  { value: 'miami', label: 'Miami, FL', lat: 25.7617, lon: -80.1918, isDefault: true },
  { value: 'scottsdale', label: 'Scottsdale, AZ', lat: 33.4942, lon: -111.9261 },
  { value: 'denver', label: 'Denver, CO', lat: 39.7392, lon: -104.9903 },
  { value: 'los-angeles', label: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437 },
  { value: 'new-york', label: 'New York, NY', lat: 40.7128, lon: -74.0060 },
  { value: 'las-vegas', label: 'Las Vegas, NV', lat: 36.1699, lon: -115.1398 },
  { value: 'chicago', label: 'Chicago, IL', lat: 41.8781, lon: -87.6298 },
  { value: 'dallas', label: 'Dallas, TX', lat: 32.7767, lon: -96.7970 },
  { value: 'atlanta', label: 'Atlanta, GA', lat: 33.7490, lon: -84.3880 },
  { value: 'phoenix', label: 'Phoenix, AZ', lat: 33.4484, lon: -112.0740 },
];

const FORECAST_RANGES = [
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '30', label: '30 Days' },
  { value: '60', label: '60 Days' },
];

const EVENT_CATEGORIES = [
  { id: 'concerts', label: 'Concerts', icon: Music, color: 'text-pink-500' },
  { id: 'sports', label: 'Sports', icon: Trophy, color: 'text-orange-500' },
  { id: 'conferences', label: 'Conferences', icon: Building2, color: 'text-blue-500' },
  { id: 'festivals', label: 'Festivals', icon: Tent, color: 'text-purple-500' },
  { id: 'performing-arts', label: 'Performing Arts', icon: Theater, color: 'text-indigo-500' },
  { id: 'expos', label: 'Expos', icon: Star, color: 'text-amber-500' },
  { id: 'community', label: 'Community', icon: Users, color: 'text-green-500' },
];

const getCategoryIcon = (category: string) => {
  const cat = EVENT_CATEGORIES.find(c => 
    c.label.toLowerCase() === category.toLowerCase() || 
    c.id === category.toLowerCase()
  );
  if (cat) {
    const Icon = cat.icon;
    return <Icon className={`h-3 w-3 ${cat.color}`} />;
  }
  return <Calendar className="h-3 w-3" />;
};

const getCategoryColor = (category: string) => {
  const cat = EVENT_CATEGORIES.find(c => 
    c.label.toLowerCase() === category.toLowerCase() || 
    c.id === category.toLowerCase()
  );
  return cat?.color || 'text-muted-foreground';
};

export const DemandForecastCard = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [demandMultiplier, setDemandMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [peakDate, setPeakDate] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState('miami');
  const [forecastDays, setForecastDays] = useState('14');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    EVENT_CATEGORIES.map(c => c.id)
  );
  const [showLegend, setShowLegend] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const city = CITIES.find(c => c.value === selectedCity);
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = addDays(new Date(), parseInt(forecastDays)).toISOString().split('T')[0];

      const response = await supabase.functions.invoke('predicthq-events', {
        body: { 
          city: selectedCity,
          location: city ? { lat: city.lat, lon: city.lon, radius: 50 } : undefined,
          startDate,
          endDate,
          categories: selectedCategories,
        },
      });
      
      if (!response.error && response.data) {
        setEvents(response.data.events || []);
        setDemandMultiplier(response.data.demandMultiplier || 1.0);
        setPeakDate(response.data.summary?.peakDate || null);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedCity, forecastDays, selectedCategories]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Filter events by selected categories
  const filteredEvents = events.filter(e => {
    const categoryId = EVENT_CATEGORIES.find(c => 
      c.label.toLowerCase() === e.category.toLowerCase()
    )?.id || e.category.toLowerCase().replace(' ', '-');
    return selectedCategories.includes(categoryId);
  });

  // Generate forecast data based on events
  const forecastData = Array.from({ length: Math.min(parseInt(forecastDays), 7) }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = filteredEvents.filter(e => e.date.startsWith(dateStr));
    const baseDemand = 65 + Math.random() * 10;
    const eventBoost = dayEvents.reduce((sum, e) => sum + (e.impactScore / 10), 0);
    const demand = Math.min(98, Math.round(baseDemand + eventBoost));
    return {
      day: format(date, 'EEE'),
      date: dateStr,
      fullDate: format(date, 'MMM d'),
      demand,
      trend: demand > 75 ? 'up' : 'down',
      hasEvent: dayEvents.length > 0,
      eventCount: dayEvents.length,
    };
  });

  const avgDemand = Math.round(forecastData.reduce((sum, d) => sum + d.demand, 0) / forecastData.length);
  const peakDay = forecastData.reduce((max, d) => d.demand > max.demand ? d : max, forecastData[0]);
  const totalAttendance = filteredEvents.reduce((sum, e) => sum + e.attendance, 0);
  const highImpactEvents = filteredEvents.filter(e => e.impactScore >= 70);

  return (
    <Card className="card-premium p-6">
      {/* Header with City & Date Selection */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-accent/20 to-primary/20 rounded-xl">
            <TrendingUp className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Demand Forecast</h3>
            <p className="text-sm text-muted-foreground">AI-powered rental demand prediction</p>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                PredictHQ
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Real-time event data from PredictHQ API</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="w-[180px]">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Select city..." />
          </SelectTrigger>
          <SelectContent className="bg-background border">
            {CITIES.map((city) => (
              <SelectItem key={city.value} value={city.value}>
                <span className="flex items-center gap-2">
                  {city.label}
                  {city.isDefault && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1">Default</Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={forecastDays} onValueChange={setForecastDays}>
          <SelectTrigger className="w-[120px]">
            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border">
            {FORECAST_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              <span>Categories</span>
              <Badge variant="secondary" className="text-xs">
                {selectedCategories.length}/{EVENT_CATEGORIES.length}
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-background border" align="start">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-sm font-medium">Event Categories</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs"
                  onClick={() => setSelectedCategories(
                    selectedCategories.length === EVENT_CATEGORIES.length 
                      ? [] 
                      : EVENT_CATEGORIES.map(c => c.id)
                  )}
                >
                  {selectedCategories.length === EVENT_CATEGORIES.length ? 'Clear' : 'All'}
                </Button>
              </div>
              {EVENT_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div 
                    key={cat.id} 
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <Checkbox 
                      checked={selectedCategories.includes(cat.id)} 
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    <Icon className={`h-4 w-4 ${cat.color}`} />
                    <span className="text-sm">{cat.label}</span>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Button 
          variant="outline" 
          size="icon"
          onClick={fetchEvents}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        {/* Legend Toggle */}
        <Button
          variant={showLegend ? "secondary" : "outline"}
          size="icon"
          onClick={() => setShowLegend(!showLegend)}
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>

      {/* Event Legend */}
      {showLegend && (
        <div className="mb-4 p-3 rounded-lg border bg-muted/20">
          <div className="text-sm font-medium mb-2">Event Legend & Metrics</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span><strong>Attendance</strong>: Expected headcount</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span><strong>Impact</strong>: 0-100 demand score</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span><strong>Multiplier</strong>: Price adjustment</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-warning/20 text-warning text-[10px]">70+</Badge>
              <span><strong>High Impact</strong>: Major event</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t">
            {EVENT_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Badge key={cat.id} variant="outline" className="text-xs gap-1">
                  <Icon className={`h-3 w-3 ${cat.color}`} />
                  {cat.label}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Forecast Visualization */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {forecastData.map((day, index) => {
          const height = (day.demand / 100) * 100;
          const isToday = index === 0;
          const isPeak = day.demand === peakDay.demand;
          
          return (
            <TooltipProvider key={day.date}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className="text-xs text-muted-foreground">{day.demand}%</div>
                    <div className="relative w-full h-24 bg-muted/30 rounded-lg overflow-hidden">
                      <div
                        className={`absolute bottom-0 w-full rounded-lg transition-all ${
                          isPeak 
                            ? "bg-gradient-to-t from-success to-success/50" 
                            : day.demand >= 80 
                              ? "bg-gradient-to-t from-warning to-warning/50"
                              : day.hasEvent
                                ? "bg-gradient-to-t from-accent to-accent/50"
                                : "bg-gradient-to-t from-primary to-primary/50"
                        }`}
                        style={{ height: `${height}%` }}
                      />
                      {day.hasEvent && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2">
                          <Badge className="text-[10px] px-1 py-0 bg-accent/80">
                            {day.eventCount}
                          </Badge>
                        </div>
                      )}
                      {isPeak && (
                        <div className="absolute top-1 right-1">
                          <TrendingUp className="h-3 w-3 text-success" />
                        </div>
                      )}
                    </div>
                    <div className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {isToday ? "Today" : day.day}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{day.fullDate}</p>
                  <p className="text-sm text-muted-foreground">{day.demand}% predicted demand</p>
                  {day.hasEvent && <p className="text-sm text-accent">{day.eventCount} event(s)</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="p-3 rounded-lg bg-muted/30 border">
          <div className="text-sm text-muted-foreground mb-1">Avg Demand</div>
          <div className="text-xl font-bold">{avgDemand}%</div>
        </div>
        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
          <div className="text-sm text-muted-foreground mb-1">Peak Day</div>
          <div className="text-xl font-bold text-success">{peakDay.day}</div>
        </div>
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
          <div className="text-sm text-muted-foreground mb-1">Events</div>
          <div className="text-xl font-bold text-accent">{events.length}</div>
        </div>
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="text-sm text-muted-foreground mb-1">Multiplier</div>
          <div className="text-xl font-bold text-primary">{demandMultiplier.toFixed(2)}x</div>
        </div>
      </div>

      {/* Upcoming Events */}
      {filteredEvents.length > 0 ? (
        <div className="p-4 rounded-lg border bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-medium">Upcoming Events</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {totalAttendance.toLocaleString()} total
              </Badge>
              {highImpactEvents.length > 0 && (
                <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">
                  {highImpactEvents.length} high impact
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {filteredEvents.slice(0, 8).map((event) => (
              <div 
                key={event.id} 
                className={`flex items-center justify-between p-2 rounded transition-colors ${
                  event.impactScore >= 70 
                    ? 'bg-warning/10 border border-warning/20' 
                    : 'bg-background/50'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`p-1.5 rounded ${
                    event.impactScore >= 70 ? 'bg-warning/20' : 'bg-muted'
                  }`}>
                    {getCategoryIcon(event.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{event.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{format(new Date(event.date), 'MMM d, h:mm a')}</span>
                      <span>•</span>
                      <span className={getCategoryColor(event.category)}>{event.category}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-xs gap-1">
                          <Users className="h-3 w-3" />
                          {event.attendance >= 1000 
                            ? `${(event.attendance / 1000).toFixed(1)}K` 
                            : event.attendance.toLocaleString()}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Expected Attendance: {event.attendance.toLocaleString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge 
                          className={`text-xs ${
                            event.impactScore >= 80 
                              ? 'bg-success/20 text-success' 
                              : event.impactScore >= 60 
                                ? 'bg-warning/20 text-warning'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {event.impactScore}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Impact Score: {event.impactScore}/100</p>
                        <p className="text-xs text-muted-foreground">
                          {event.impactScore >= 80 ? 'Very High Demand' 
                            : event.impactScore >= 60 ? 'High Demand' 
                            : 'Moderate Demand'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
          {filteredEvents.length > 8 && (
            <div className="text-center mt-2">
              <span className="text-xs text-muted-foreground">
                +{filteredEvents.length - 8} more events
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-dashed bg-muted/20">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Calendar className="h-5 w-5" />
            <span>{loading ? 'Loading events...' : 'No events found for this period'}</span>
          </div>
        </div>
      )}
    </Card>
  );
};
