import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import {
  TrendingUp,
  TrendingDown,
  Calendar as CalendarIcon,
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
  BarChart3,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  Brain,
  DollarSign,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays, differenceInDays, startOfDay, subMonths, subYears } from "date-fns";
import { DateRange } from "react-day-picker";
import { useAIDemandForecast, type DemandForecast, type PricingAdjustment, type Opportunity } from "@/hooks/useAIDemandForecast";

type Booking = Tables<'bookings'>;

interface EventData {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  category: string;
  attendance: number;
  impactScore: number;
  labels?: string[];
}

interface DemandForecastCardProps {
  bookings?: Booking[];
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

const QUICK_RANGES = [
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '30', label: '30 Days' },
  { value: '60', label: '60 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const EVENT_CATEGORIES = [
  { id: 'concerts', label: 'Concerts', icon: Music, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  { id: 'sports', label: 'Sports', icon: Trophy, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'conferences', label: 'Conferences', icon: Building2, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'festivals', label: 'Festivals', icon: Tent, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'performing-arts', label: 'Performing Arts', icon: Theater, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  { id: 'expos', label: 'Expos', icon: Star, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'community', label: 'Community', icon: Users, color: 'text-green-500', bgColor: 'bg-green-500/10' },
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
  return <CalendarIcon className="h-3 w-3" />;
};

const getCategoryData = (category: string) => {
  return EVENT_CATEGORIES.find(c => 
    c.label.toLowerCase() === category.toLowerCase() || 
    c.id === category.toLowerCase()
  ) || { color: 'text-muted-foreground', bgColor: 'bg-muted' };
};

export const DemandForecastCard = ({ bookings = [] }: DemandForecastCardProps) => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [demandMultiplier, setDemandMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [peakDate, setPeakDate] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState('miami');
  const [quickRange, setQuickRange] = useState('14');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 14),
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    EVENT_CATEGORIES.map(c => c.id)
  );
  const [showLegend, setShowLegend] = useState(false);
  const [activeTab, setActiveTab] = useState('forecast');
  
  // AI Demand Forecast hook
  const { 
    forecast: aiForecast, 
    loading: aiLoading, 
    generateForecast,
    error: aiError 
  } = useAIDemandForecast();

  // Compute real booking metrics
  const bookingMetrics = useMemo(() => {
    const now = new Date();
    const lastMonth = subMonths(now, 1);
    const lastYear = subYears(now, 1);

    const currentMonthBookings = bookings.filter(b => {
      const date = new Date(b.created_at || b.start_date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const lastMonthBookings = bookings.filter(b => {
      const date = new Date(b.created_at || b.start_date);
      return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
    });
    const lastYearSameMonthBookings = bookings.filter(b => {
      const date = new Date(b.created_at || b.start_date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === lastYear.getFullYear();
    });

    const currentMonthRevenue = currentMonthBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
    const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
    const lastYearRevenue = lastYearSameMonthBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);

    const momChange = lastMonthRevenue > 0 
      ? Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : currentMonthRevenue > 0 ? 100 : null;
    const yoyChange = lastYearRevenue > 0 
      ? Math.round(((currentMonthRevenue - lastYearRevenue) / lastYearRevenue) * 100)
      : currentMonthRevenue > 0 ? 100 : null;

    // Compute avg booking duration from completed/confirmed bookings
    const completedBookings = bookings.filter(b => 
      b.status === 'completed' || b.status === 'confirmed' || b.status === 'active'
    );
    let avgDuration = 0;
    if (completedBookings.length > 0) {
      const totalDays = completedBookings.reduce((sum, b) => {
        const start = new Date(b.start_date);
        const end = new Date(b.end_date);
        return sum + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      avgDuration = totalDays / completedBookings.length;
    }

    return {
      currentMonthRevenue,
      momChange,
      yoyChange,
      avgBookingDuration: avgDuration > 0 ? `${avgDuration.toFixed(1)} days` : 'No data',
      totalBookings: bookings.length,
    };
  }, [bookings]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const city = CITIES.find(c => c.value === selectedCity);
      const startDate = dateRange?.from 
        ? format(dateRange.from, 'yyyy-MM-dd') 
        : format(new Date(), 'yyyy-MM-dd');
      const endDate = dateRange?.to 
        ? format(dateRange.to, 'yyyy-MM-dd') 
        : format(addDays(new Date(), 14), 'yyyy-MM-dd');

      const response = await supabase.functions.invoke('ai-event-intelligence', {
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
  }, [selectedCity, dateRange, selectedCategories]);

  // Generate AI forecast when events are loaded
  const handleGenerateAIForecast = useCallback(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    const cityLabel = CITIES.find(c => c.value === selectedCity)?.label || selectedCity;
    
    const eventData = events.map(e => ({
      name: e.name,
      date: e.date,
      attendance: e.attendance,
      impactScore: e.impactScore,
      category: e.category,
    }));
    
    generateForecast(
      cityLabel,
      { from: dateRange.from, to: dateRange.to },
      undefined,
      undefined,
      eventData
    );
  }, [dateRange, selectedCity, events, generateForecast]);

  const handleQuickRangeChange = (value: string) => {
    setQuickRange(value);
    if (value !== 'custom') {
      const days = parseInt(value);
      setDateRange({
        from: new Date(),
        to: addDays(new Date(), days),
      });
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Filter events by selected categories
  const filteredEvents = useMemo(() => events.filter(e => {
    const categoryId = EVENT_CATEGORIES.find(c => 
      c.label.toLowerCase() === e.category.toLowerCase()
    )?.id || e.category.toLowerCase().replace(' ', '-');
    return selectedCategories.includes(categoryId);
  }), [events, selectedCategories]);

  // Calculate date range in days
  const rangeDays = dateRange?.from && dateRange?.to 
    ? differenceInDays(dateRange.to, dateRange.from) + 1 
    : 14;

  // Generate forecast data based on events + real booking density
  const forecastData = useMemo(() => {
    const startDate = dateRange?.from || new Date();
    
    // Build day-of-week weights from real booking data
    const dayBookingCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const dayTotals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    bookings.forEach(b => {
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      // Count each day the booking spans
      const current = new Date(start);
      while (current <= end) {
        const dow = current.getDay();
        dayBookingCounts[dow]++;
        dayTotals[dow]++;
        current.setDate(current.getDate() + 1);
      }
    });

    // Calculate weights — if we have booking data, use it; otherwise use sensible defaults
    const totalBookingDays = Object.values(dayBookingCounts).reduce((a, b) => a + b, 0);
    const defaultWeights: Record<number, number> = { 0: 72, 1: 60, 2: 58, 3: 62, 4: 68, 5: 78, 6: 80 };
    
    const dayWeights: Record<number, number> = totalBookingDays > 7
      ? (() => {
          const maxCount = Math.max(...Object.values(dayBookingCounts), 1);
          const weights: Record<number, number> = {};
          for (let i = 0; i < 7; i++) {
            weights[i] = Math.round(45 + (dayBookingCounts[i] / maxCount) * 50);
          }
          return weights;
        })()
      : defaultWeights;

    return Array.from({ length: rangeDays }, (_, i) => {
      const date = addDays(startDate, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayEvents = filteredEvents.filter(e => e.date.startsWith(dateStr));
      const dayOfWeek = date.getDay();
      const baseDemand = dayWeights[dayOfWeek] || 65;
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
        events: dayEvents,
      };
    });
  }, [dateRange, filteredEvents, rangeDays, bookings]);

  // Event Impact Analysis (merged from old Impact tab)
  const impactAnalysis = useMemo(() => {
    const categoryBreakdown = EVENT_CATEGORIES.map(cat => {
      const catEvents = filteredEvents.filter(e => 
        e.category.toLowerCase() === cat.label.toLowerCase() ||
        e.category.toLowerCase().replace(' ', '-') === cat.id
      );
      const totalAttendance = catEvents.reduce((sum, e) => sum + e.attendance, 0);
      const avgImpact = catEvents.length > 0 
        ? Math.round(catEvents.reduce((sum, e) => sum + e.impactScore, 0) / catEvents.length)
        : 0;
      const revenueImpact = Math.round((avgImpact / 100) * totalAttendance * 0.05);
      
      return {
        ...cat,
        eventCount: catEvents.length,
        totalAttendance,
        avgImpact,
        revenueImpact,
        topEvent: catEvents.sort((a, b) => b.impactScore - a.impactScore)[0],
      };
    }).filter(c => c.eventCount > 0).sort((a, b) => b.revenueImpact - a.revenueImpact);

    return {
      categoryBreakdown,
      recommendedPriceIncrease: Math.round((demandMultiplier - 1) * 100),
    };
  }, [filteredEvents, demandMultiplier]);

  const avgDemand = Math.round(forecastData.reduce((sum, d) => sum + d.demand, 0) / forecastData.length);
  const peakDay = forecastData.reduce((max, d) => d.demand > max.demand ? d : max, forecastData[0]);
  const totalAttendance = filteredEvents.reduce((sum, e) => sum + e.attendance, 0);
  const highImpactEvents = filteredEvents.filter(e => e.impactScore >= 70);

  return (
    <Card className="card-premium p-6">
      {/* Header */}
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
                MotorIQ Intelligence
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI-powered event data from MotorIQ Intelligence engine</p>
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
        
        <Select value={quickRange} onValueChange={handleQuickRangeChange}>
          <SelectTrigger className="w-[130px]">
            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border">
            {QUICK_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={quickRange === 'custom' ? 'secondary' : 'outline'} 
              className="gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <span className="text-xs">
                    {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                  </span>
                ) : (
                  format(dateRange.from, 'MMM d, yyyy')
                )
              ) : (
                <span>Pick dates</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-background border" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) {
                  setQuickRange('custom');
                }
              }}
              numberOfMonths={2}
              disabled={(date) => date < startOfDay(new Date())}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
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
              <Target className="h-4 w-4 text-success" />
              <span><strong>Impact</strong>: 0-100 demand score</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
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

      {/* Tabs: Forecast + AI Pricing (Impact Analysis merged into Forecast) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="forecast" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Demand</span> Forecast
          </TabsTrigger>
          <TabsTrigger value="ai-pricing" className="gap-2">
            <Brain className="h-4 w-4" />
            AI <span className="hidden sm:inline">Pricing</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forecast" className="mt-4 space-y-4">
          {/* Forecast Visualization */}
          <div className="grid grid-cols-7 gap-2">
            {forecastData.slice(0, 7).map((day, index) => {
              const height = (day.demand / 100) * 100;
              const isToday = index === 0 && format(dateRange?.from || new Date(), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              const isPeak = day.demand === peakDay.demand;
              
              return (
                <TooltipProvider key={day.date}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-2 cursor-pointer group">
                        <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{day.demand}%</div>
                        <div className={`relative w-full h-24 bg-muted/30 rounded-lg overflow-hidden group-hover:bg-muted/50 transition-colors ${day.hasEvent ? 'ring-2 ring-performance-orange/20' : ''}`}>
                          <div
                            className={`absolute bottom-0 w-full rounded-lg transition-all ${
                              isPeak 
                                ? "bg-gradient-to-t from-success to-success/60" 
                                : day.demand >= 75 
                                  ? "bg-gradient-to-t from-performance-orange to-performance-orange/60"
                                  : day.demand >= 60
                                    ? "bg-gradient-to-t from-gulf-blue to-gulf-blue/60"
                                    : "bg-gradient-to-t from-gulf-blue/70 to-gulf-blue/40"
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
                        <div className="text-[10px] text-muted-foreground">{day.fullDate}</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">{day.fullDate}</p>
                      <p className="text-sm text-muted-foreground">{day.demand}% predicted demand</p>
                      {day.hasEvent && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-accent font-medium">{day.eventCount} event(s):</p>
                          {day.events.slice(0, 3).map(e => (
                            <p key={e.id} className="text-xs text-muted-foreground truncate">
                              • {e.name} ({e.attendance.toLocaleString()})
                            </p>
                          ))}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          {/* Week 2 */}
          {forecastData.length > 7 && (
            <div className="grid grid-cols-7 gap-2">
              {forecastData.slice(7, 14).map((day) => {
                const height = (day.demand / 100) * 100;
                const isPeak = day.demand === peakDay.demand;
                
                return (
                  <TooltipProvider key={day.date}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-center gap-2 cursor-pointer group">
                          <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{day.demand}%</div>
                          <div className={`relative w-full h-20 bg-muted/30 rounded-lg overflow-hidden group-hover:bg-muted/50 transition-colors ${day.hasEvent ? 'ring-2 ring-performance-orange/20' : ''}`}>
                            <div
                              className={`absolute bottom-0 w-full rounded-lg transition-all ${
                                isPeak 
                                  ? "bg-gradient-to-t from-success to-success/60" 
                                  : day.demand >= 75 
                                    ? "bg-gradient-to-t from-performance-orange to-performance-orange/60"
                                    : day.demand >= 60
                                      ? "bg-gradient-to-t from-gulf-blue to-gulf-blue/60"
                                      : "bg-gradient-to-t from-gulf-blue/70 to-gulf-blue/40"
                              }`}
                              style={{ height: `${height}%` }}
                            />
                            {day.hasEvent && (
                              <Badge className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] px-1 py-0 bg-accent/80">
                                {day.eventCount}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{day.day}</div>
                          <div className="text-[10px] text-muted-foreground">{day.fullDate}</div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{day.fullDate}</p>
                        <p className="text-sm">{day.demand}% demand</p>
                        {day.hasEvent && <p className="text-sm text-accent">{day.eventCount} event(s)</p>}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}


          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border">
              <div className="text-sm text-muted-foreground mb-1">Avg Demand</div>
              <div className="text-xl font-bold">{avgDemand}%</div>
            </div>
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <div className="text-sm text-muted-foreground mb-1">Peak Day</div>
              <div className="text-xl font-bold text-success">{peakDay.fullDate}</div>
            </div>
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
              <div className="text-sm text-muted-foreground mb-1">Total Events</div>
              <div className="text-xl font-bold text-accent">{filteredEvents.length}</div>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="text-sm text-muted-foreground mb-1">Price Multiplier</div>
              <div className="text-xl font-bold text-primary">{demandMultiplier.toFixed(2)}x</div>
            </div>
          </div>

          {/* Merged Impact Analysis Section */}
          <div className="space-y-4 pt-2 border-t">
            {/* Revenue Comparison (real data) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">YoY Revenue</span>
                  {bookingMetrics.yoyChange !== null && bookingMetrics.yoyChange >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div className={`text-2xl font-bold ${
                  bookingMetrics.yoyChange !== null && bookingMetrics.yoyChange >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {bookingMetrics.yoyChange !== null ? `${bookingMetrics.yoyChange > 0 ? '+' : ''}${bookingMetrics.yoyChange}%` : '--'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">vs same month last year</p>
              </div>
              <div className="p-4 rounded-lg border bg-gradient-to-br from-accent/5 to-accent/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">MoM Revenue</span>
                  {bookingMetrics.momChange !== null && bookingMetrics.momChange >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div className={`text-2xl font-bold ${
                  bookingMetrics.momChange !== null && bookingMetrics.momChange >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {bookingMetrics.momChange !== null ? `${bookingMetrics.momChange > 0 ? '+' : ''}${bookingMetrics.momChange}%` : '--'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">vs last month</p>
              </div>
              <div className="p-4 rounded-lg border bg-gradient-to-br from-success/5 to-success/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Price Suggestion</span>
                  <Zap className="h-4 w-4 text-success" />
                </div>
                <div className="text-2xl font-bold text-success">
                  +{impactAnalysis.recommendedPriceIncrease}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">recommended increase</p>
              </div>
              <div className="p-4 rounded-lg border bg-gradient-to-br from-warning/5 to-warning/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Avg Duration</span>
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <div className="text-lg font-bold text-warning">
                  {bookingMetrics.avgBookingDuration}
                </div>
                <p className="text-xs text-muted-foreground mt-1">avg booking length</p>
              </div>
            </div>

            {/* Category Impact Breakdown */}
            {impactAnalysis.categoryBreakdown.length > 0 && (
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <span className="font-medium">Category Impact Breakdown</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {totalAttendance.toLocaleString()} total attendance
                  </Badge>
                </div>
                <div className="space-y-3">
                  {impactAnalysis.categoryBreakdown.map((cat) => {
                    const Icon = cat.icon;
                    const maxRevenue = Math.max(...impactAnalysis.categoryBreakdown.map(c => c.revenueImpact));
                    const barWidth = (cat.revenueImpact / maxRevenue) * 100;
                    
                    return (
                      <div key={cat.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${cat.bgColor}`}>
                              <Icon className={`h-4 w-4 ${cat.color}`} />
                            </div>
                            <span className="font-medium text-sm">{cat.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {cat.eventCount} events
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">
                              {cat.totalAttendance.toLocaleString()} attendees
                            </span>
                            <Badge className={`${cat.avgImpact >= 70 ? 'bg-success/20 text-success' : 'bg-muted'}`}>
                              {cat.avgImpact} avg impact
                            </Badge>
                            <span className="font-semibold text-success">
                              +${cat.revenueImpact.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${cat.bgColor.replace('/10', '/50')}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        {cat.topEvent && (
                          <p className="hidden md:block text-xs text-muted-foreground pl-8">
                            Top: {cat.topEvent.name} ({cat.topEvent.attendance.toLocaleString()} attendees)
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* High Impact Events Alert */}
            {highImpactEvents.length > 0 && (
              <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-warning" />
                  <span className="font-medium">High Impact Events ({highImpactEvents.length})</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {highImpactEvents.slice(0, 4).map(event => {
                    const catData = getCategoryData(event.category);
                    return (
                      <div key={event.id} className="flex items-center gap-3 p-2 rounded bg-background/50">
                        <div className={`p-1.5 rounded ${catData.bgColor}`}>
                          {getCategoryIcon(event.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{event.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.date), 'MMM d')} • {event.attendance.toLocaleString()} attendees
                          </p>
                        </div>
                        <Badge className="bg-warning/20 text-warning">{event.impactScore}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* AI Pricing & Predictions Tab */}
        <TabsContent value="ai-pricing" className="mt-4 space-y-4">
          {/* Generate Forecast Button */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-br from-primary/5 to-accent/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">AI Demand Predictions</h4>
                <p className="text-sm text-muted-foreground">
                  Get AI-powered pricing suggestions based on {events.length} upcoming events
                </p>
              </div>
            </div>
            <Button 
              onClick={handleGenerateAIForecast}
              disabled={aiLoading || events.length === 0}
              className="gap-2"
            >
              {aiLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {aiLoading ? 'Analyzing...' : 'Generate Forecast'}
            </Button>
          </div>

          {/* AI Error State */}
          {aiError && (
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Forecast Error</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{aiError}</p>
            </div>
          )}

          {/* AI Forecast Results */}
          {aiForecast && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Predicted Bookings</span>
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {aiForecast.summary.totalPredictedBookings}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    next {aiForecast.dailyPredictions.length} days
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-gradient-to-br from-success/5 to-success/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Projected Revenue</span>
                    <DollarSign className="h-4 w-4 text-success" />
                  </div>
                  <div className="text-2xl font-bold text-success">
                    ${(aiForecast.summary.projectedRevenue / 1000).toFixed(1)}K
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {aiForecast.summary.comparedToLastPeriod > 0 ? '+' : ''}{aiForecast.summary.comparedToLastPeriod}% vs last period
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-gradient-to-br from-accent/5 to-accent/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">AI Confidence</span>
                    <Target className="h-4 w-4 text-accent" />
                  </div>
                  <div className="text-2xl font-bold text-accent">
                    {aiForecast.summary.averageConfidence}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    prediction accuracy
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-gradient-to-br from-warning/5 to-warning/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Demand Trend</span>
                    {aiForecast.summary.demandTrend === 'increasing' ? (
                      <ArrowUpRight className="h-4 w-4 text-success" />
                    ) : aiForecast.summary.demandTrend === 'decreasing' ? (
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className={`text-2xl font-bold capitalize ${
                    aiForecast.summary.demandTrend === 'increasing' ? 'text-success' : 
                    aiForecast.summary.demandTrend === 'decreasing' ? 'text-destructive' : 
                    'text-warning'
                  }`}>
                    {aiForecast.summary.demandTrend}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    market direction
                  </p>
                </div>
              </div>

              {/* Pricing Adjustments with inline events */}
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    <span className="font-medium">AI Pricing Suggestions</span>
                  </div>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="h-3 w-3" />
                    {aiForecast.pricingAdjustments.length} categories
                  </Badge>
                </div>
                <div className="space-y-3">
                  {aiForecast.pricingAdjustments.map((adj, idx) => {
                    // Find events that are relevant to this pricing adjustment
                    const relevantEvents = filteredEvents.filter(e => 
                      e.impactScore >= 50 && (
                        adj.reason.toLowerCase().includes(e.category.toLowerCase()) ||
                        adj.reason.toLowerCase().includes('event') ||
                        e.impactScore >= 70
                      )
                    ).slice(0, 2);

                    return (
                      <div key={idx} className="p-3 rounded-lg bg-background/50 border space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{adj.category}</span>
                              {adj.changePercent > 0 ? (
                                <Badge className="bg-success/20 text-success text-xs">
                                  +{adj.changePercent}%
                                </Badge>
                              ) : adj.changePercent < 0 ? (
                                <Badge className="bg-destructive/20 text-destructive text-xs">
                                  {adj.changePercent}%
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Optimal
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{adj.reason}</p>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-sm text-muted-foreground line-through">
                              ${adj.currentRate.toLocaleString()}/day
                            </div>
                            <div className="text-lg font-bold text-success">
                              ${adj.suggestedRate.toLocaleString()}/day
                            </div>
                          </div>
                        </div>
                        {/* Inline relevant events */}
                        {relevantEvents.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed">
                            {relevantEvents.map(event => {
                              const catData = getCategoryData(event.category);
                              return (
                                <div key={event.id} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-full px-2 py-1">
                                  {getCategoryIcon(event.category)}
                                  <span className="font-medium truncate max-w-[120px]">{event.name}</span>
                                  <Badge className={`text-[10px] px-1 py-0 ${
                                    event.impactScore >= 70 ? 'bg-warning/20 text-warning' : 'bg-muted'
                                  }`}>
                                    {event.impactScore}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revenue Opportunities */}
              <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="h-5 w-5 text-warning" />
                  <span className="font-medium">Top Revenue Opportunities</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {aiForecast.opportunities.slice(0, 3).map((opp, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${
                      opp.priority === 'high' ? 'bg-success/10 border-success/30' :
                      opp.priority === 'medium' ? 'bg-warning/10 border-warning/30' :
                      'bg-muted/50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={`text-xs ${
                          idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : 'bg-amber-700'
                        } text-white`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} #{idx + 1}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(opp.date), 'MMM d')}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-success mb-1">
                        +${(opp.potentialRevenue / 1000).toFixed(1)}K
                      </div>
                      <p className="text-xs text-muted-foreground">{opp.reason}</p>
                      {opp.eventName && (
                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {opp.eventName}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Prediction Breakdown */}
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span className="font-medium">Daily Booking Predictions</span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {aiForecast.dailyPredictions.slice(0, 7).map((pred, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(pred.date), 'EEE')}
                      </span>
                      <div className={`text-lg font-bold ${
                        pred.demandLevel === 'peak' ? 'text-success' :
                        pred.demandLevel === 'high' ? 'text-warning' :
                        pred.demandLevel === 'medium' ? 'text-primary' :
                        'text-muted-foreground'
                      }`}>
                        {pred.predictedBookings}
                      </div>
                      <Badge className={`text-[10px] px-1 py-0 ${
                        pred.demandLevel === 'peak' ? 'bg-success/20 text-success' :
                        pred.demandLevel === 'high' ? 'bg-warning/20 text-warning' :
                        pred.demandLevel === 'medium' ? 'bg-primary/20 text-primary' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {pred.confidence}%
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        ${(pred.projectedRevenue / 1000).toFixed(1)}K
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Empty State */}
          {!aiForecast && !aiLoading && !aiError && (
            <div className="p-8 rounded-lg border border-dashed bg-muted/20 text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h4 className="font-medium mb-2">No AI Forecast Generated</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Click "Generate Forecast" to get AI-powered predictions and pricing suggestions
              </p>
              <Button 
                onClick={handleGenerateAIForecast}
                disabled={events.length === 0}
                variant="outline"
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate Now
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upcoming Events (shown below tabs on forecast tab) */}
      {activeTab === 'forecast' && filteredEvents.length > 0 && (
        <div className="p-4 rounded-lg border bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
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
            {filteredEvents.slice(0, 8).map((event) => {
              const catData = getCategoryData(event.category);
              return (
                <div 
                  key={event.id} 
                  className={`flex items-center justify-between p-2 rounded transition-colors ${
                    event.impactScore >= 70 
                      ? 'bg-warning/10 border border-warning/20' 
                      : 'bg-background/50'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`p-1.5 rounded ${event.impactScore >= 70 ? 'bg-warning/20' : catData.bgColor}`}>
                      {getCategoryIcon(event.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{event.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{format(new Date(event.date), 'MMM d, h:mm a')}</span>
                        <span>•</span>
                        <span className={catData.color}>{event.category}</span>
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
              );
            })}
          </div>
          {filteredEvents.length > 8 && (
            <div className="text-center mt-2">
              <span className="text-xs text-muted-foreground">
                +{filteredEvents.length - 8} more events
              </span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'forecast' && filteredEvents.length === 0 && (
        <div className="p-4 rounded-lg border border-dashed bg-muted/20">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <CalendarIcon className="h-5 w-5" />
            <span>{loading ? 'Loading events...' : 'No events found for this period'}</span>
          </div>
        </div>
      )}
    </Card>
  );
};
