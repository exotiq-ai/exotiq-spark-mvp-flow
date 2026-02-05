import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface IdentifyVehicleRequest {
  imageUrl: string;
  filename?: string;
}

interface IdentifyVehicleResponse {
  isVehicle: boolean;
  confidence: number;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  angle?: string;
  bodyStyle?: string;
  suggestedVehicleMatch?: {
    make: string;
    color: string;
  };
  quality: {
    score: number;
    issues: string[];
  };
  labels: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageUrl, filename } = await req.json() as IdentifyVehicleRequest;
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing vehicle image: ${filename || imageUrl.substring(0, 50)}...`);

    // Call Gemini 2.5 Flash for vehicle identification
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this vehicle photo and provide detailed identification. Return ONLY valid JSON (no markdown, no code blocks) in this exact format:

{
  "isVehicle": true/false,
  "confidence": 0-100,
  "make": "manufacturer name (e.g., Ferrari, Lamborghini, McLaren)",
  "model": "specific model (e.g., 488 GTB, Huracán EVO, 720S)",
  "year": estimated year as number or null,
  "color": "exterior color using manufacturer names if recognizable (e.g., Rosso Corsa, Arancio Borealis)",
  "angle": "one of: front, front_quarter, side_left, side_right, rear, rear_quarter, interior, engine, detail, overhead",
  "bodyStyle": "one of: coupe, sedan, suv, convertible, roadster, hatchback, wagon, truck, van",
  "quality": {
    "score": 0-100,
    "issues": ["list of quality issues like 'dark lighting', 'blurry', 'partially obscured']"
  }
}

Be specific with exotic and luxury car identification. For example:
- Recognize specific Ferrari models (488, F8, SF90, Roma, etc.)
- Distinguish Lamborghini variants (Huracán EVO, Performante, STO)
- Identify McLaren models (720S, 765LT, Artura)
- Detect special editions and trim levels when visible

If this is not a vehicle, set isVehicle to false and leave other fields empty or null.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response - handle markdown code blocks if present
    let analysisResult: IdentifyVehicleResponse;
    try {
      // Strip markdown code blocks if present
      let jsonContent = content.trim();
      if (jsonContent.startsWith("```json")) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith("```")) {
        jsonContent = jsonContent.slice(0, -3);
      }
      jsonContent = jsonContent.trim();
      
      const parsed = JSON.parse(jsonContent);
      
      analysisResult = {
        isVehicle: parsed.isVehicle ?? false,
        confidence: parsed.confidence ?? 0,
        make: parsed.make || undefined,
        model: parsed.model || undefined,
        year: parsed.year || undefined,
        color: parsed.color || undefined,
        angle: parsed.angle || undefined,
        bodyStyle: parsed.bodyStyle || undefined,
        suggestedVehicleMatch: parsed.make && parsed.color ? {
          make: parsed.make,
          color: parsed.color
        } : undefined,
        quality: {
          score: parsed.quality?.score ?? 80,
          issues: parsed.quality?.issues ?? []
        },
        labels: [parsed.make, parsed.model, parsed.color, parsed.bodyStyle].filter(Boolean)
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", content, parseError);
      // Return a default "vehicle detected" response on parse failure
      analysisResult = {
        isVehicle: true,
        confidence: 50,
        quality: { score: 70, issues: ["AI analysis incomplete"] },
        labels: []
      };
    }

    console.log(`Vehicle identified: ${analysisResult.make} ${analysisResult.model} (${analysisResult.confidence}% confidence)`);

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("identify-vehicle error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
