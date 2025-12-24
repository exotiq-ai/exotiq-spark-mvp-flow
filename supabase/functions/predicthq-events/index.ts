import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventRequest {
  location?: {
    lat: number;
    lon: number;
    radius?: number; // in km
  };
  city?: string;
  startDate?: string;
  endDate?: string;
  categories?: string[];
}

interface PredictHQEvent {
  id: string;
  title: string;
  category: string;
  start: string;
  end?: string;
  predicted_attendance?: number;
  rank?: number;
  labels?: string[];
  location?: number[];
}

interface EventResponse {
  events: Array<{
    id: string;
    name: string;
    date: string;
    endDate?: string;
    category: string;
    attendance: number;
    impactScore: number;
    labels: string[];
  }>;
  demandMultiplier: number;
  summary: {
    totalEvents: number;
    highImpactEvents: number;
    peakDate: string | null;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PREDICTHQ_API_KEY = Deno.env.get('PREDICTHQ_API_KEY');
    
    if (!PREDICTHQ_API_KEY) {
      console.log('PredictHQ API key not configured, returning mock data');
      return new Response(JSON.stringify(getMockEventData()), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as EventRequest;
    const { location, city, startDate, endDate, categories } = body;

    console.log('Fetching events from PredictHQ:', { location, city, startDate, endDate });

    // Build query parameters
    const params = new URLSearchParams();
    
    // Date range (default: next 14 days)
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    params.append('active.gte', start);
    params.append('active.lte', end);

    // Location
    if (location) {
      params.append('within', `${location.radius || 25}km@${location.lat},${location.lon}`);
    } else if (city) {
      params.append('place.scope', city);
    } else {
      // Default to Miami if no location specified (luxury car rental hub)
      params.append('place.scope', 'miami');
    }

    // Categories that impact car rentals
    const eventCategories = categories || [
      'concerts',
      'sports',
      'conferences',
      'festivals',
      'performing-arts',
      'expos',
      'community'
    ];
    params.append('category', eventCategories.join(','));

    // Sort by impact and limit results
    params.append('sort', '-rank');
    params.append('limit', '50');

    const response = await fetch(`https://api.predicthq.com/v1/events?${params}`, {
      headers: {
        'Authorization': `Bearer ${PREDICTHQ_API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PredictHQ API error:', response.status, errorText);
      
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Invalid PredictHQ API key. Please check your configuration.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Return mock data on API error
      return new Response(JSON.stringify(getMockEventData()), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const events: PredictHQEvent[] = data.results || [];

    console.log(`Found ${events.length} events from PredictHQ`);

    // Process and transform events
    const processedEvents = events.map(event => ({
      id: event.id,
      name: event.title,
      date: event.start,
      endDate: event.end,
      category: formatCategory(event.category),
      attendance: event.predicted_attendance || estimateAttendance(event.rank || 0),
      impactScore: event.rank || 0,
      labels: event.labels || [],
    }));

    // Calculate demand multiplier based on events
    const demandMultiplier = calculateDemandMultiplier(processedEvents);

    // Find peak date
    const dateAttendance: Record<string, number> = {};
    processedEvents.forEach(event => {
      const date = event.date.split('T')[0];
      dateAttendance[date] = (dateAttendance[date] || 0) + event.attendance;
    });
    
    const peakEntry = Object.entries(dateAttendance).sort((a, b) => b[1] - a[1])[0];

    const eventResponse: EventResponse = {
      events: processedEvents,
      demandMultiplier,
      summary: {
        totalEvents: processedEvents.length,
        highImpactEvents: processedEvents.filter(e => e.impactScore >= 70).length,
        peakDate: peakEntry ? peakEntry[0] : null,
      },
    };

    return new Response(JSON.stringify(eventResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PredictHQ function error:', error);
    // Return mock data on error
    return new Response(JSON.stringify(getMockEventData()), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    'concerts': 'Concert',
    'sports': 'Sports',
    'conferences': 'Conference',
    'festivals': 'Festival',
    'performing-arts': 'Performing Arts',
    'expos': 'Expo',
    'community': 'Community Event',
  };
  return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function estimateAttendance(rank: number): number {
  // Estimate attendance based on event rank (0-100)
  if (rank >= 90) return 50000;
  if (rank >= 80) return 25000;
  if (rank >= 70) return 10000;
  if (rank >= 60) return 5000;
  if (rank >= 50) return 2500;
  if (rank >= 40) return 1000;
  return 500;
}

function calculateDemandMultiplier(events: Array<{ attendance: number; impactScore: number }>): number {
  if (events.length === 0) return 1.0;

  // Calculate weighted impact
  const totalImpact = events.reduce((sum, event) => {
    const weight = event.impactScore / 100;
    const attendanceWeight = Math.min(event.attendance / 50000, 1);
    return sum + (weight * attendanceWeight);
  }, 0);

  // Convert to multiplier (1.0 - 1.5 range)
  const multiplier = 1 + Math.min(totalImpact * 0.1, 0.5);
  return Math.round(multiplier * 100) / 100;
}

function getMockEventData(): EventResponse {
  const today = new Date();
  const events = [
    {
      id: 'mock-1',
      name: 'Miami Music Festival',
      date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'Festival',
      attendance: 25000,
      impactScore: 85,
      labels: ['music', 'outdoor'],
    },
    {
      id: 'mock-2',
      name: 'Tech Innovation Summit',
      date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'Conference',
      attendance: 5000,
      impactScore: 72,
      labels: ['technology', 'business'],
    },
    {
      id: 'mock-3',
      name: 'Pro Basketball Game',
      date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'Sports',
      attendance: 20000,
      impactScore: 78,
      labels: ['sports', 'entertainment'],
    },
    {
      id: 'mock-4',
      name: 'Luxury Auto Show',
      date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'Expo',
      attendance: 15000,
      impactScore: 80,
      labels: ['automotive', 'luxury'],
    },
  ];

  return {
    events,
    demandMultiplier: 1.25,
    summary: {
      totalEvents: events.length,
      highImpactEvents: events.filter(e => e.impactScore >= 70).length,
      peakDate: events[0].date.split('T')[0],
    },
  };
}
