import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingRequest {
  vehicle: {
    id: string;
    name: string;
    make: string;
    model: string;
    year: number;
    currentRate: number;
    utilization: number;
    revenue: number;
  };
  bookingHistory?: {
    totalBookings: number;
    averageRate: number;
    peakDays: string[];
  };
  eventData?: {
    upcomingEvents: Array<{
      name: string;
      date: string;
      attendance: number;
      category: string;
    }>;
    demandMultiplier: number;
  };
  startDate?: string;
}

interface PricingResponse {
  suggestedRate: number;
  confidence: number;
  reasoning: string;
  factors: Array<{
    name: string;
    impact: number;
    description: string;
  }>;
  expectedRevenue: {
    daily: number;
    monthly: number;
    improvement: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { vehicle, bookingHistory, eventData, startDate } = await req.json() as PricingRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing pricing for vehicle:', vehicle.name);

    // Build context for AI
    const currentDate = new Date();
    const month = currentDate.toLocaleString('default', { month: 'long' });
    const dayOfWeek = currentDate.toLocaleString('default', { weekday: 'long' });
    
    const prompt = `You are an expert pricing analyst for luxury vehicle rentals. Analyze the following data and provide optimal pricing recommendations.

VEHICLE DATA:
- Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.name})
- Current Daily Rate: $${vehicle.currentRate}
- Utilization Rate: ${vehicle.utilization}%
- Total Revenue: $${vehicle.revenue}

MARKET CONTEXT:
- Current Month: ${month}
- Day of Week: ${dayOfWeek}
${startDate ? `- Requested Rental Start Date: ${startDate}` : ''}

${bookingHistory ? `BOOKING HISTORY:
- Total Bookings: ${bookingHistory.totalBookings}
- Average Rate Achieved: $${bookingHistory.averageRate}
- Peak Demand Days: ${bookingHistory.peakDays.join(', ')}` : ''}

${eventData && eventData.upcomingEvents.length > 0 ? `UPCOMING LOCAL EVENTS:
${eventData.upcomingEvents.map(e => `- ${e.name} (${e.date}): ~${e.attendance} attendees, Category: ${e.category}`).join('\n')}
Event Demand Multiplier: ${eventData.demandMultiplier}x` : ''}

Based on this data, provide a JSON response with your pricing recommendation. Consider:
1. Utilization-based pricing (high utilization = premium pricing opportunity)
2. Seasonal factors (summer/holidays typically command higher rates)
3. Day-of-week patterns (weekends typically higher)
4. Event-based demand spikes
5. Vehicle category and luxury positioning

Respond with ONLY a valid JSON object in this exact format:
{
  "suggestedRate": <number>,
  "confidence": <number 0-100>,
  "reasoning": "<2-3 sentence explanation>",
  "factors": [
    {"name": "<factor name>", "impact": <percent change>, "description": "<brief explanation>"}
  ],
  "monthlyRevenuePotential": <number>
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are a pricing optimization AI for a luxury vehicle rental fleet. Always respond with valid JSON only, no markdown or explanation outside the JSON.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    console.log('AI Response:', content);

    // Parse JSON from response (handle markdown code blocks)
    let parsedContent: any;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedContent = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback to rule-based pricing
      parsedContent = calculateFallbackPricing(vehicle, eventData);
    }

    // Build the full response
    const pricingResponse: PricingResponse = {
      suggestedRate: Math.round(parsedContent.suggestedRate / 5) * 5, // Round to nearest $5
      confidence: parsedContent.confidence || 75,
      reasoning: parsedContent.reasoning || 'AI-powered pricing recommendation based on market analysis.',
      factors: parsedContent.factors || [],
      expectedRevenue: {
        daily: parsedContent.suggestedRate,
        monthly: parsedContent.monthlyRevenuePotential || parsedContent.suggestedRate * 20,
        improvement: Math.round(((parsedContent.suggestedRate - vehicle.currentRate) / vehicle.currentRate) * 100),
      },
    };

    return new Response(JSON.stringify(pricingResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Pricing error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to analyze pricing' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateFallbackPricing(vehicle: PricingRequest['vehicle'], eventData?: PricingRequest['eventData']) {
  let suggestedRate = vehicle.currentRate;
  const factors: Array<{name: string; impact: number; description: string}> = [];

  // Utilization-based adjustment
  if (vehicle.utilization > 80) {
    const increase = 15;
    suggestedRate *= (1 + increase / 100);
    factors.push({
      name: 'High Demand',
      impact: increase,
      description: `${vehicle.utilization}% utilization indicates strong demand`
    });
  } else if (vehicle.utilization < 50) {
    const decrease = 5;
    suggestedRate *= (1 - decrease / 100);
    factors.push({
      name: 'Low Utilization',
      impact: -decrease,
      description: 'Consider competitive pricing to boost bookings'
    });
  }

  // Seasonal adjustment
  const month = new Date().getMonth();
  if ([5, 6, 7, 11].includes(month)) {
    const increase = 10;
    suggestedRate *= (1 + increase / 100);
    factors.push({
      name: 'Peak Season',
      impact: increase,
      description: 'Summer/holiday season premium pricing'
    });
  }

  // Event-based adjustment
  if (eventData && eventData.demandMultiplier > 1) {
    const increase = Math.round((eventData.demandMultiplier - 1) * 100);
    suggestedRate *= eventData.demandMultiplier;
    factors.push({
      name: 'Local Events',
      impact: increase,
      description: `${eventData.upcomingEvents.length} upcoming events driving demand`
    });
  }

  return {
    suggestedRate: Math.round(suggestedRate),
    confidence: 70,
    reasoning: 'Rule-based pricing recommendation based on utilization and seasonal factors.',
    factors,
    monthlyRevenuePotential: Math.round(suggestedRate * 20)
  };
}
